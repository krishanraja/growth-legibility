import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildReport, publicSummary } from '../src/orchestrator.mjs';
import { validateSnapshot, validateReport, sha256 } from '../src/guards/wire.mjs';
import { checkInvitations } from '../scripts/check-invitation.mjs';
import { MINDMAKE_COPY } from '../src/stages/prepare.mjs';
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
// It runs on the real clock, so every date here is set from now. The child gets only Windows' SystemRoot from the
// environment, and removal retries and never throws (docs/FAILURES.md F27).
test('the invitation check prints only opaque ids and hold codes and fails when any item is held',t=>{
  const repo=fileURLToPath(new URL('..',import.meta.url)), dir=mkdtempSync(join(tmpdir(),'growth-legibility-invite-'));
  const links=mkdtempSync(join(tmpdir(),'growth-legibility-link-'));
  t.after(()=>{for(const d of [links,dir]){try{rmSync(d,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{}}});
  for(const part of ['package.json','src','config']) cpSync(join(repo,part),join(dir,part),{recursive:true});
  mkdirSync(join(dir,'scripts')); cpSync(join(repo,'scripts','check-invitation.mjs'),join(dir,'scripts','check-invitation.mjs'));
  mkdirSync(join(dir,'runtime','input'),{recursive:true});
  const DAY=86_400_000, now=Date.now(), iso=ms=>new Date(Math.floor(ms/1000)*1000).toISOString(), captured_at=iso(now-3_600_000);
  const base=fixture().candidates[0];
  const person=(id,patch={})=>{const c=structuredClone(base); c.id=id; c.current_signal.observed_at=iso(now-DAY); return {...c,...patch};};
  const clear=person('candidate-example'), unknown=person('candidate-unknown-history'), record=base.contact.prior_mindmake.record_url;
  delete unknown.contact.prior_mindmake;
  const sentByKrish={state:'sent',by:'krish',state_at:iso(now-30*DAY),last_touch_at:iso(now-20*DAY),record_url:record};
  const env=process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{};
  const write=(name,body)=>{writeFileSync(join(dir,'runtime','input',name),JSON.stringify(body)); return `runtime/input/${name}`;};
  const check=(input,extra=[],script=join(dir,'scripts','check-invitation.mjs'))=>spawnSync(process.execPath,[script,'--input',input,...extra],{cwd:dir,env,encoding:'utf8',timeout:30000});
  const codes=candidates=>{const r=check(write('case.json',{captured_at,candidates})); return {status:r.status,codes:JSON.parse(r.stdout).items.map(i=>i.codes)};};
  const refused=(input,code,extra=[])=>{const r=check(input,extra); assert.equal(r.status,1,code); assert.equal(r.stderr,`${code}\n`); assert.equal(r.stdout,'',code);};
  const mixed=check(write('mixed.json',{captured_at,candidates:[clear,unknown]}));
  assert.equal(mixed.status,1,mixed.stderr);
  assert.deepEqual(JSON.parse(mixed.stdout),{checked:2,held:1,items:[{item:sha256(clear.id).slice(0,16),codes:[]},{item:sha256(unknown.id).slice(0,16),codes:['mindmake_history_unknown']}]});
  for(const secret of [clear.id,unknown.id,clear.company,clear.project,'calibrated confidence','https','example.']) assert.ok(!`${mixed.stdout}${mixed.stderr}`.includes(secret),secret);
  const ok=check(write('clear.json',{captured_at,candidates:[clear]}));
  assert.equal(ok.status,0,ok.stderr); assert.equal(JSON.parse(ok.stdout).held,0);
  // The same person reached for Mindmake by Krish 20 days ago: words without the opening are held on a first note, and the
  // approved lines for the record pass. A Legibility follow-up sent after that touch needs no opening.
  assert.deepEqual(codes([person('reached',{contact:{...clear.contact,prior_mindmake:sentByKrish}})]),{status:1,codes:[['partner_framing_missing']]});
  const month=new Date(Date.parse(sentByKrish.state_at)), monthName=month.toLocaleString('en-US',{month:'long',timeZone:'UTC'})+(month.getUTCFullYear()===new Date(now).getUTCFullYear()?'':` ${month.getUTCFullYear()}`);
  const opening=`${MINDMAKE_COPY.bridge.sent.replace('{month}',monthName)} ${MINDMAKE_COPY.shared}`;
  const bridged={...clear.draft,text:`${opening} ${clear.draft.text}`};
  assert.deepEqual(codes([person('reached',{contact:{...clear.contact,prior_mindmake:sentByKrish},draft:bridged})]),{status:0,codes:[[]]});
  assert.deepEqual(codes([person('reached',{contact:{...clear.contact,prior_mindmake:sentByKrish,last_sent_at:iso(now-10*DAY)}})]),{status:0,codes:[[]]});
  // The draft checks run: Mindmake named, and its offer, to a person never reached for it.
  const named=person('named',{draft:{...clear.draft,text:`${clear.draft.text} It is part of the paid pilot at mindmake.co.`}});
  assert.deepEqual(codes([named]),{status:1,codes:[['mindmake_named_without_touch','mindmake_offer_mentioned']]});
  // Prepare's whole gate runs, so the check holds what prepare would hold.
  const variants=[
    [person('opted-out',{contact:{...clear.contact,status:'opt_out'}}),'suppressed'],
    [person('followups',{contact:{...clear.contact,followups:3}}),'followup_limit_or_invalid_history'],
    [person('used-followup',{contact:{...clear.contact,prior_mindmake:sentByKrish,last_sent_at:iso(now-10*DAY),followups:9}}),'followup_limit_or_invalid_history'],
    [person('kind',{relationship:{...clear.relationship,kind:'banana'}}),'invalid_candidate'],
    [person('pool',{pool:'zzz'}),'invalid_candidate'],
    [person('warm',{relationship:{kind:'warm',evidence:null,url:null}}),'relationship_not_evidenced'],
    [person('stale',{current_signal:{...clear.current_signal,observed_at:iso(now-60*DAY)}}),'signal_not_current_verified_reference'],
    [person('channel',{channel:''}),'missing_channel'],
    [person('low',{scores:{...clear.scores,fit:0,project:0}}),'research_below_threshold'],
    [person('recent',{contact:{...clear.contact,prior_mindmake:{...sentByKrish,last_touch_at:iso(now-3*DAY)}}}),'mindmake_touch_too_recent'],
  ];
  for(const [c,code] of variants) assert.deepEqual(codes([c]),{status:1,codes:[[code]]},code);
  // A malformed candidate is held with the wire's code, and an id that is not one is named.
  assert.deepEqual(codes([{...clear,exporter_note:'x'}]).codes,[['invalid_contract:unknown_fields_candidate']]);
  assert.deepEqual(codes([person('bad id')]).codes,[['invalid_candidate_id']]);
  // Every item that shares an id is held: the same item twice, or two versions of it.
  assert.deepEqual(codes([clear,clear]).codes,[['duplicate_candidate_id'],['duplicate_candidate_id']]);
  assert.deepEqual(codes([clear,{...named,id:clear.id}]).codes,[['conflicting_candidate'],['conflicting_candidate','mindmake_named_without_touch','mindmake_offer_mentioned']]);
  // The input itself: a capture in the future or over a day old, an extra key, too many items, and a clock of its own.
  refused(write('future.json',{captured_at:iso(now+DAY),candidates:[clear]}),'invalid_input_capture');
  refused(write('old.json',{captured_at:iso(now-2*DAY),candidates:[clear]}),'input_stale_capture');
  refused(write('extra.json',{captured_at,candidates:[clear],note:'x'}),'invalid_input');
  refused(write('many.json',{captured_at,candidates:Array.from({length:101},(_,i)=>person(`p-${i}`))}),'invalid_input_candidates');
  refused('runtime/input/clear.json','invalid_cli_arguments',['--at',iso(now)]);
  // The limits come from config/policy.json, as they do for run; a policy the wire refuses stops the check.
  const policyFile=join(dir,'config','policy.json'), kept=readFileSync(policyFile,'utf8');
  writeFileSync(policyFile,JSON.stringify({...JSON.parse(kept),max_candidate_age_days:1}));
  assert.deepEqual(codes([person('two-days',{current_signal:{...clear.current_signal,observed_at:iso(now-2*DAY)}})]),{status:1,codes:[['signal_not_current_verified_reference']]});
  writeFileSync(policyFile,JSON.stringify({...JSON.parse(kept),max_followups:2}));
  refused('runtime/input/clear.json','policy_unreadable');
  writeFileSync(policyFile,kept);
  // Input outside the private spool is refused before it is read, and so is a link inside the spool that points out of it.
  refused('package.json','input_must_be_private_runtime');
  try { symlinkSync(join(dir,'package.json'),join(dir,'runtime','input','link.json')); } catch { t.diagnostic('symlinks not permitted here; link cases skipped'); return; }
  refused('runtime/input/link.json','input_must_be_private_runtime');
  // Started through a linked folder, the check still runs and still fails closed.
  symlinkSync(dir,join(links,'repo'),'junction');
  const linked=check('runtime/input/mixed.json',[],join(links,'repo','scripts','check-invitation.mjs'));
  assert.equal(linked.status,1,linked.stderr); assert.equal(JSON.parse(linked.stdout).held,1);
  const linkedClear=check('runtime/input/clear.json',[],join(links,'repo','scripts','check-invitation.mjs'));
  assert.equal(linkedClear.status,0,linkedClear.stderr); assert.equal(JSON.parse(linkedClear.stdout).held,0);
});
test('the invitation check prints a code, never an error message, and refuses a clock or policy it cannot use',()=>{
  const c=structuredClone(fixture().candidates[0]), input={captured_at:'2026-10-18T11:00:00Z',candidates:[c]};
  assert.deepEqual(checkInvitations(input,at).items[0].codes,[]);
  // A policy the gate refuses throws a sentence; the item is held under one code that quotes nothing.
  assert.deepEqual(checkInvitations(input,at,{max_followups:-1}).items[0].codes,['candidate_check_failed']);
  assert.throws(()=>checkInvitations(input,'2026-10-18'),/^Error: invalid_clock$/);
  assert.throws(()=>checkInvitations(input,at,{max_snapshot_age_hours:48}),/^Error: invalid_policy$/);
  assert.throws(()=>checkInvitations(input,'2026-10-19T11:00:01Z'),/^Error: input_stale_capture$/);
  assert.equal(checkInvitations(input,'2026-10-19T11:00:00Z').held,0);
});
