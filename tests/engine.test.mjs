import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildReport, publicSummary } from '../src/orchestrator.mjs';
import { validateSnapshot, validateReport, sha256 } from '../src/guards/wire.mjs';
const fixture=()=>JSON.parse(readFileSync(new URL('../fixtures/snapshot.json',import.meta.url)));
const policy=()=>JSON.parse(readFileSync(new URL('../config/policy.json',import.meta.url)));
const at='2026-10-18T12:00:00Z', corpus='a'.repeat(64);
test('complete source traverses producer stages into independently sealed final report',()=>{
  const r=buildReport(fixture(),policy(),at,corpus);
  const {payload_sha256,...body}=r;
  assert.equal(sha256(body),payload_sha256);
  assert.equal(r.mode,'synthetic');
  assert.equal(r.scorecard.metrics.qualified_enrolments.value,2);
  assert.equal(r.scorecard.metrics.first_trusted_reads.value,1);
  assert.ok(r.actions.length>0);
  assert.deepEqual(buildReport(fixture(),policy(),at,corpus),r);
});
test('source replay with exact duplicate records does not double count',()=>{
  const f=fixture(); const base=buildReport(f,policy(),at,corpus);
  f.accounts.push(structuredClone(f.accounts[0])); f.reads.push(structuredClone(f.reads[0]));
  const replay=buildReport(f,policy(),at,corpus);
  assert.deepEqual(replay,base);
});
test('conflicting duplicate source IDs fail instead of silently choosing a winner',()=>{
  const f=fixture(); f.reads.push({...f.reads[0],confidence:0});
  assert.throws(()=>buildReport(f,policy(),at,corpus),/conflicting_duplicate/);
});
test('private evidence never enters the presentation summary',()=>{
  const f=fixture(); f.candidates[0].company='PRIVATE-COMPANY-CANARY';
  f.candidates[0].current_signal.text='PRIVATE-SOURCE-CANARY enough signal to identify this particular integration experiment';
  const r=buildReport(f,policy(),at,corpus);
  const s=JSON.stringify(publicSummary(r));
  for(const secret of ['PRIVATE-COMPANY-CANARY','PRIVATE-SOURCE-CANARY','builder-a','candidate-example','https://example.org/synthetic-project']) assert.ok(!s.includes(secret),secret);
});
test('stale or partial source emits a held report with no actionable drafts',()=>{
  const f=fixture(); f.mode='live';
  const stale=buildReport(f,policy(),'2026-10-20T12:00:00Z',corpus);
  assert.equal(stale.status,'held'); assert.equal(stale.actions.length,0);
  f.window.complete=false;
  const partial=buildReport(f,policy(),at,corpus);
  assert.equal(partial.status,'held'); assert.equal(partial.scorecard.metrics.qualified_enrolments.value,null);
});
test('paid media discrepancy and overdue source review fail closed',()=>{
  const f=fixture(); f.spend.paid_media_usd=1;
  assert.equal(buildReport(f,policy(),at,corpus).status,'held');
  const p=policy();p.source_review_due=at;
  assert.equal(buildReport(fixture(),p,at,corpus).actions.length,0);
});
test('future records, nonfinite ranges and orphan reads rejected',()=>{
  for(const mutate of [f=>f.reads[0].occurred_at='2027-01-01T00:00:00Z',f=>f.reads[0].confidence=2,f=>f.reads[0].cost_usd=NaN,f=>f.reads[0].account_id='missing']) {
    const f=fixture(); mutate(f);assert.throws(()=>validateSnapshot(f,at),/invalid_contract/);
  }
});
test('tampered output cannot be delivered',()=>{
  const r=buildReport(fixture(),policy(),at,corpus);r.scorecard.metrics.qualified_enrolments.value=999;
  assert.throws(()=>validateReport(r),/digest/);
});
test('timestamps require real UTC instants and alias evidence rejects cycles or missing targets',()=>{
  for (const value of ['2026-10-01T10:00:00','2026-02-30T10:00:00Z','2026-10-01T10:00:00+02:00']) {
    const f=fixture();f.accounts[0].enrolled_at=value;assert.throws(()=>validateSnapshot(f,at),/account_dates/);
  }
  const f=fixture();f.accounts[0].canonical_id=f.accounts[1].id;f.accounts[1].canonical_id=f.accounts[0].id;
  assert.throws(()=>validateSnapshot(f,at),/cyclic_canonical_identity/);
  f.accounts[1].canonical_id='missing';assert.throws(()=>validateSnapshot(f,at),/dangling_canonical_identity/);
});
test('approved ICP must belong to Legibility and contain canonical buyer evidence',()=>{
  for(const change of [{product_slug:'other-product'},{source:'copied-corpus'},{buyer_definition:''}]) {
    const f=fixture();Object.assign(f.icp,change);assert.throws(()=>validateSnapshot(f,at),/icp_/);
  }
});
test('unknown exporter metadata cannot silently flow into report transport',()=>{
  for(const mutate of [f=>f.opportunities[0].request_headers={authorization:'SYNTHETIC-CANARY'},f=>f.candidates[0].contact.exported_auth='SYNTHETIC-CANARY']) {
    const f=fixture();mutate(f);assert.throws(()=>buildReport(f,policy(),at,corpus),/unknown_fields/);
  }
});
// Control Center's Mindmake record for the fixture's person (Ruling, Krish, 2026-10-27): a closed object of five keys.
const RECORD='https://example.com/cc/person/candidate-example', DATED=['2026-09-01T10:00:00Z','2026-09-02T10:00:00Z'];
const mm=(state,by=null,state_at=null,last_touch_at=null,record_url=RECORD)=>({state,by,state_at,last_touch_at,record_url});
const withRecord=m=>{const f=fixture();f.candidates[0].contact.prior_mindmake=m;return f;};
test('a candidate Mindmake record is a closed object of five keys, and null, a partial record or an extra key refuses the snapshot',()=>{
  const f=fixture();delete f.candidates[0].contact.prior_mindmake;assert.doesNotThrow(()=>validateSnapshot(f,at));
  for(const m of [mm('unknown',null,null,null,null),mm('none'),mm('open'),mm('open',null,...DATED),mm('client'),mm('client',null,...DATED),mm('drafted',null,...DATED),mm('sent','krish',...DATED),mm('sent','other',...DATED),mm('replied','krish',...DATED),mm('replied','other',...DATED),mm('met','krish',...DATED),mm('met','krish',DATED[0],DATED[0])]) {
    assert.doesNotThrow(()=>validateSnapshot(withRecord(m),at),JSON.stringify(m));
  }
  for(const m of [null,[],'none',0,{...mm('none'),note:'SYNTHETIC-CANARY'}]) assert.throws(()=>validateSnapshot(withRecord(m),at),/invalid_contract:unknown_fields_candidate_prior_mindmake$/,JSON.stringify(m));
  for(const key of ['state','by','state_at','last_touch_at','record_url']) {const m=mm('none');delete m[key];assert.throws(()=>validateSnapshot(withRecord(m),at),/invalid_contract:candidate_prior_mindmake_shape$/,key);}
  for(const state of ['pending','None','',null]) assert.throws(()=>validateSnapshot(withRecord(mm(state)),at),/invalid_contract:candidate_prior_mindmake_state$/,String(state));
});
test('a Mindmake record carries a sender, dates and a record link only where its state allows, never dated after capture',()=>{
  const shape=/invalid_contract:candidate_prior_mindmake_shape$/, record=/invalid_contract:candidate_prior_mindmake_record$/;
  for(const [m,code] of [
    [mm('none',null,DATED[0]),shape],[mm('none',null,null,DATED[0]),shape],[mm('none','krish'),shape],
    [mm('unknown',null,null,null,RECORD),record],[mm('unknown',null,DATED[0],null,null),shape],[mm('unknown','other',null,null,null),shape],
    [mm('open','krish'),shape],[mm('client','other'),shape],
    [mm('sent',null,...DATED),shape],[mm('replied',null,...DATED),shape],[mm('sent','someone',...DATED),shape],[mm('met','other',...DATED),shape],[mm('met',null,...DATED),shape],[mm('drafted','krish',...DATED),shape],
    [mm('sent','krish'),shape],[mm('drafted',null,DATED[0]),shape],[mm('met','krish',null,DATED[1]),shape],
    [mm('sent','krish',DATED[1],DATED[0]),shape],[mm('open',null,DATED[1],DATED[0]),shape],
    [mm('sent','krish','2026-10-18T12:00:01Z','2026-10-18T12:00:01Z'),shape],[mm('client',null,null,'2026-10-18T12:00:01Z'),shape],[mm('open',null,'2026-10-19T00:00:00Z'),shape],
    [mm('sent','krish','2026-09-01T10:00:00+01:00',DATED[1]),shape],[mm('sent','krish','2026-02-30T10:00:00Z',DATED[1]),shape],
    [mm('none',null,null,null,null),record],[mm('none',null,null,null,'http://example.com/cc/person/x'),record],[mm('none',null,null,null,'https://user:pass@example.com/cc/person/x'),record],
    [mm('none',null,null,null,`https://example.com/${'a'.repeat(1981)}`),record],[mm('none',null,null,null,'https://example.com/cc person'),record],[mm('none',null,null,null,'example.com/cc/person/x'),record],
    [mm('sent','krish',...DATED,null),record],
  ]) assert.throws(()=>validateSnapshot(withRecord(m),at),code,JSON.stringify(m));
  // The controls: a link of exactly 2000 characters and a last touch at the capture instant are taken.
  assert.doesNotThrow(()=>validateSnapshot(withRecord(mm('none',null,null,null,`https://example.com/${'a'.repeat(1980)}`)),at));
  assert.doesNotThrow(()=>validateSnapshot(withRecord(mm('sent','krish',DATED[0],'2026-10-18T12:00:00Z')),at));
});
// The check runs from a byte copy in the OS temp directory, so its private input never lands in this repository's runtime/.
// The child gets only Windows' SystemRoot from the environment, and removal retries and never throws (docs/FAILURES.md F27).
test('the invitation check prints only opaque ids and hold codes and fails when any item is held',t=>{
  const repo=fileURLToPath(new URL('..',import.meta.url)), dir=mkdtempSync(join(tmpdir(),'growth-legibility-invite-'));
  t.after(()=>{try{rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{}});
  for(const part of ['package.json','src']) cpSync(join(repo,part),join(dir,part),{recursive:true});
  mkdirSync(join(dir,'scripts')); cpSync(join(repo,'scripts','check-invitation.mjs'),join(dir,'scripts','check-invitation.mjs'));
  mkdirSync(join(dir,'runtime','input'),{recursive:true});
  const f=fixture(), clear=f.candidates[0], unknown={...structuredClone(clear),id:'candidate-unknown-history'};
  delete unknown.contact.prior_mindmake;
  writeFileSync(join(dir,'runtime','input','mixed.json'),JSON.stringify({captured_at:f.captured_at,candidates:[clear,unknown]}));
  writeFileSync(join(dir,'runtime','input','clear.json'),JSON.stringify({captured_at:f.captured_at,candidates:[clear]}));
  const env=process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{};
  const check=input=>spawnSync(process.execPath,[join(dir,'scripts','check-invitation.mjs'),'--input',input,'--at',at],{cwd:dir,env,encoding:'utf8',timeout:30000});
  const mixed=check('runtime/input/mixed.json');
  assert.equal(mixed.status,1,mixed.stderr);
  assert.deepEqual(JSON.parse(mixed.stdout),{checked:2,held:1,items:[{item:sha256(clear.id).slice(0,16),codes:[]},{item:sha256(unknown.id).slice(0,16),codes:['mindmake_history_unknown']}]});
  for(const secret of [clear.id,unknown.id,clear.company,clear.project,'calibrated confidence','https','example.']) assert.ok(!`${mixed.stdout}${mixed.stderr}`.includes(secret),secret);
  const ok=check('runtime/input/clear.json');
  assert.equal(ok.status,0,ok.stderr); assert.equal(JSON.parse(ok.stdout).held,0);
  // A person who opted out is held whatever their Mindmake record says.
  writeFileSync(join(dir,'runtime','input','opted-out.json'),JSON.stringify({captured_at:f.captured_at,candidates:[{...clear,contact:{...clear.contact,status:'opt_out'}}]}));
  const optedOut=check('runtime/input/opted-out.json');
  assert.equal(optedOut.status,1); assert.deepEqual(JSON.parse(optedOut.stdout).items[0].codes,['contact_status_unknown']);
  // Input outside the private spool is refused before it is read.
  const outside=check('package.json');
  assert.equal(outside.status,1); assert.equal(outside.stderr,'input_must_be_private_runtime\n'); assert.equal(outside.stdout,'');
});
