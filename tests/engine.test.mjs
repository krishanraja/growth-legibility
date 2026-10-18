import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
