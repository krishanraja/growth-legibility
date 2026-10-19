import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Outbox } from '../src/outbox.mjs';
import { deliver } from '../src/transport.mjs';
import { buildReport, engineReport, protocolRunId } from '../src/orchestrator.mjs';
import { sha256 } from '../src/guards/wire.mjs';
import { standIn, TOKEN } from './standin.mjs';
function report(){
  const r=buildReport(JSON.parse(readFileSync(new URL('../fixtures/snapshot.json',import.meta.url))),JSON.parse(readFileSync(new URL('../config/policy.json',import.meta.url))),'2026-10-18T12:00:00Z','a'.repeat(64));
  return engineReport(r,{runId:protocolRunId('run',r.observed_at,r.run_id.slice(3,19))});
}
function journal(){return join(mkdtempSync(join(tmpdir(),'growth-legibility-')),'outbox.sqlite');}
const receiver=standIn;
test('actual HTTP write + independent readback + restart produces one accepted run',async t=>{
  const env=await receiver(t);const file=journal();let db=new Outbox(file);const r=report();db.put(r);
  const receipt=await deliver(db,r.run_id,env);assert.equal(receipt.payload_sha256,r.payload_sha256);assert.equal(receipt.replayed,false);db.close();
  db=new Outbox(file);t.after(()=>db.close());await deliver(db,r.run_id,env);
  assert.equal(env.posts(),1);assert.equal(db.get(r.run_id).status,'delivered');assert.equal(db.get(r.run_id).attempts,1);
  const post=env.log.find(x=>x.method==='POST'&&x.route==='/reports');
  assert.equal(post.headers['idempotency-key'],r.run_id);assert.equal(post.headers.authorization,`Bearer ${TOKEN}`);
});
test('green HTTP acknowledgement without persistence stays unverified and shares retry budget across restarts',async t=>{
  const env=await receiver(t,{persist:false});const file=journal();const r=report();
  for(let i=0;i<3;i++){
    const db=new Outbox(file);db.put(r);await assert.rejects(deliver(db,r.run_id,env),/delivery_unverified/);assert.equal(db.get(r.run_id).attempts,i+1);
    assert.equal(db.get(r.run_id).last_error,'receiver_did_not_persist');db.close();
  }
  const db=new Outbox(file);t.after(()=>db.close());await assert.rejects(deliver(db,r.run_id,env),/attempt_budget/);assert.equal(env.posts(),3);
});
test('ambiguous POST which actually persisted reconciles without another write',async t=>{
  const env=await receiver(t,{dropAfterPersist:true});const db=new Outbox(journal());t.after(()=>db.close());const r=report();db.put(r);
  await assert.rejects(deliver(db,r.run_id,env),e=>e.code==='receiver_transport_uncertain');
  const receipt=await deliver(db,r.run_id,env);assert.equal(receipt.replayed,true);assert.equal(env.posts(),1);assert.equal(db.get(r.run_id).status,'delivered');
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
  await assert.rejects(deliver(db,r.run_id,{base:'http://controlcenter.krishraja.com',token:'synthetic-test-credential'}),/origin_not_approved/);
  await assert.rejects(deliver(db,r.run_id,{token:''}),/credential_missing/);
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
  assert.deepEqual(Object.keys(receipt).sort(),['accepted','payload_sha256','replayed','run_id']);
  assert.ok(!JSON.stringify(receipt).includes('SYNTHETIC-RECEIPT-CANARY'));
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
test('a re-sent report the receiver already holds is answered replayed: true and confirmed by readback',async t=>{
  // The first readback misses, so the client writes; the receiver already holds the same digest and replays.
  const r=report();const env=await receiver(t,{conflictWith:r,hideReadbacks:1});const db=new Outbox(journal());t.after(()=>db.close());db.put(r);
  const receipt=await deliver(db,r.run_id,env);
  assert.equal(receipt.replayed,true);assert.equal(receipt.payload_sha256,r.payload_sha256);assert.equal(env.posts(),1);
  assert.equal(db.get(r.run_id).status,'delivered');
});
test('a 409 conflict is read back and never retried blindly',async t=>{
  const r=report();
  const other={...r,status:'held'};const {payload_sha256,...body}=other;other.payload_sha256=sha256(body);
  const env=await receiver(t,{conflictWith:other,hideReadbacks:1});const db=new Outbox(journal());t.after(()=>db.close());db.put(r);
  await assert.rejects(deliver(db,r.run_id,env),e=>e.code==='receiver_report_conflict');
  assert.equal(env.posts(),1);assert.equal(db.get(r.run_id).last_error,'receiver_report_conflict');
  // A later reconcile reads the conflicting record first and stops before any write.
  await assert.rejects(deliver(db,r.run_id,env),/readback_mismatch/);assert.equal(env.posts(),1);
  const reads=env.log.filter(x=>x.method==='GET'&&x.route.startsWith('/reports/')).length;assert.ok(reads>=3);
});
test('an inactive engine refusal is named and leaves nothing marked delivered',async t=>{
  const r={...report(),mode:'live'};const {payload_sha256,...body}=r;r.payload_sha256=sha256(body);
  const env=await receiver(t,{inactive:true});const db=new Outbox(journal());t.after(()=>db.close());db.put(r);
  await assert.rejects(deliver(db,r.run_id,env),e=>e.code==='receiver_engine_inactive');
  assert.equal(db.get(r.run_id).status,'uncertain');
});
test('a 401 is a lower_snake code and the bearer never appears in the error, the journal or the receipt',async t=>{
  const env=await receiver(t,{unauthorized:['reports']});const db=new Outbox(journal());t.after(()=>db.close());const r=report();db.put(r);
  const error=await deliver(db,r.run_id,env).catch(e=>e);
  assert.equal(error.code,'receiver_unauthorized');
  assert.ok(!`${error.message} ${error.stack} ${JSON.stringify(db.get(r.run_id))}`.includes(TOKEN));
});
