import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { Outbox } from '../src/outbox.mjs';
import { deliver } from '../src/transport.mjs';
import { buildReport } from '../src/orchestrator.mjs';
const PREFIX='/api/growth/engines/legibility';
function report(){return buildReport(JSON.parse(readFileSync(new URL('../fixtures/snapshot.json',import.meta.url))),JSON.parse(readFileSync(new URL('../config/policy.json',import.meta.url))),'2026-10-18T12:00:00Z','a'.repeat(64));}
function journal(){return join(mkdtempSync(join(tmpdir(),'growth-legibility-')),'outbox.sqlite');}
async function receiver(t, {persist=true,badAck=false,dropAfterPersist=false,wrongCapability=false,beforePost=null,extraReceipt=false}={}) {
  const stored=new Map();let posts=0;
  const server=createServer(async(req,res)=>{
    res.setHeader('content-type','application/json');
    if(req.url===`${PREFIX}/capabilities`) {res.end(JSON.stringify({schema_version:'1.0.0',engine_id:'growth-legibility',product_slug:wrongCapability?'other':'legibility',idempotency:true}));return;}
    if(req.method==='GET') {
      const id=req.url.split('/').at(-1);const r=stored.get(id);
      if(!r){res.statusCode=404;res.end('{}');return;}res.end(JSON.stringify(r));return;
    }
    posts++;if(beforePost)await beforePost();let body='';for await(const chunk of req)body+=chunk;
    const r=JSON.parse(body);assert.equal(req.headers['idempotency-key'],r.run_id);
    const receipt={accepted:true,run_id:r.run_id,payload_sha256:badAck?'wrong':r.payload_sha256,...(extraReceipt?{private_debug:'SYNTHETIC-RECEIPT-CANARY'}:{})};
    if(persist)stored.set(r.run_id,receipt);
    if(dropAfterPersist){req.socket.destroy();return;}res.end(JSON.stringify(receipt));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return {base:`http://127.0.0.1:${server.address().port}`,testMode:true,token:'synthetic-test-credential',posts:()=>posts,stored};
}
test('actual HTTP write + independent readback + restart produces one accepted run',async t=>{
  const env=await receiver(t);const file=journal();let db=new Outbox(file);const r=report();db.put(r);
  const receipt=await deliver(db,r.run_id,env);assert.equal(receipt.payload_sha256,r.payload_sha256);db.close();
  db=new Outbox(file);t.after(()=>db.close());await deliver(db,r.run_id,env);
  assert.equal(env.posts(),1);assert.equal(db.get(r.run_id).status,'delivered');assert.equal(db.get(r.run_id).attempts,1);
});
test('green HTTP acknowledgement without persistence stays unverified and shares retry budget across restarts',async t=>{
  const env=await receiver(t,{persist:false});const file=journal();const r=report();
  for(let i=0;i<3;i++){
    const db=new Outbox(file);db.put(r);await assert.rejects(deliver(db,r.run_id,env),/delivery_unverified/);assert.equal(db.get(r.run_id).attempts,i+1);db.close();
  }
  const db=new Outbox(file);t.after(()=>db.close());await assert.rejects(deliver(db,r.run_id,env),/attempt_budget/);assert.equal(env.posts(),3);
});
test('ambiguous POST which actually persisted reconciles without another write',async t=>{
  const env=await receiver(t,{dropAfterPersist:true});const db=new Outbox(journal());t.after(()=>db.close());const r=report();db.put(r);
  await assert.rejects(deliver(db,r.run_id,env),/delivery_unverified/);
  await deliver(db,r.run_id,env);assert.equal(env.posts(),1);assert.equal(db.get(r.run_id).status,'delivered');
});
test('wrong capability or wrong acknowledgement fails closed',async t=>{
  const db=new Outbox(journal());t.after(()=>db.close());const r=report();db.put(r);
  const bad=await receiver(t,{wrongCapability:true});await assert.rejects(deliver(db,r.run_id,bad),/contract_mismatch/);assert.equal(bad.posts(),0);
  const ack=await receiver(t,{badAck:true});await assert.rejects(deliver(db,r.run_id,ack),/delivery_unverified/);assert.equal(db.get(r.run_id).status,'uncertain');
});
test('production transport refuses synthetic data and unapproved origin before network',async t=>{
  const db=new Outbox(journal());t.after(()=>db.close());const r=report();db.put(r);
  await assert.rejects(deliver(db,r.run_id,{token:'synthetic-test-credential'}),/synthetic_delivery/);
  let networkCalls=0;
  await assert.rejects(deliver(db,r.run_id,{token:'synthetic-test-credential',testMode:true,fetcher:async()=>{networkCalls++;throw new Error('unexpected_network');}}),/synthetic_delivery/);
  assert.equal(networkCalls,0);
  await assert.rejects(deliver(db,r.run_id,{base:'https://example.org',token:'synthetic-test-credential'}),/origin_not_approved/);
});
test('overlapping delivery processes cannot consume a second attempt while the first POST is in flight',async t=>{
  let announce,release;
  const started=new Promise(resolve=>announce=resolve), gate=new Promise(resolve=>release=resolve);
  const env=await receiver(t,{beforePost:async()=>{announce();await gate;}});
  const file=journal(), a=new Outbox(file),b=new Outbox(file);t.after(()=>{a.close();b.close();});
  const r=report();a.put(r);
  const first=deliver(a,r.run_id,env);await started;
  await assert.rejects(deliver(b,r.run_id,env),/attempt_budget_or_reconciliation_required/);
  release();await first;assert.equal(env.posts(),1);assert.equal(a.get(r.run_id).attempts,1);
});
test('receipt readback cannot echo arbitrary private receiver metadata to logs or disk',async t=>{
  const env=await receiver(t,{extraReceipt:true}), db=new Outbox(journal());t.after(()=>db.close());const r=report();db.put(r);
  const receipt=await deliver(db,r.run_id,env);
  assert.deepEqual(Object.keys(receipt).sort(),['accepted','payload_sha256','run_id']);
  assert.ok(!db.get(r.run_id).receipt.includes('SYNTHETIC-RECEIPT-CANARY'));
});
test('a resumed stale process cannot clear or complete a newer reservation after lease expiry',t=>{
  const db=new Outbox(journal());t.after(()=>db.close());const r=report();db.put(r);
  const old=db.reserve(r.run_id,1000), current=db.reserve(r.run_id,121001);
  const lease=db.get(r.run_id).lease_until;
  assert.equal(db.error(r.run_id,'receiver_transport_uncertain',old),false);
  assert.equal(db.delivered(r.run_id,{accepted:true,run_id:r.run_id,payload_sha256:r.payload_sha256},old),false);
  assert.equal(db.get(r.run_id).lease_until,lease);
  assert.throws(()=>db.reserve(r.run_id,121002),/attempt_budget_or_reconciliation_required/);
  assert.equal(db.get(r.run_id).attempts,current);
});
