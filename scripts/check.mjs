import { readFileSync,readdirSync,existsSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { validatePolicy,validateSnapshot } from '../src/guards/wire.mjs';
import { buildReport, engineReport, protocolRunId } from '../src/orchestrator.mjs';
const root=resolve(import.meta.dirname,'..');
const json=p=>JSON.parse(readFileSync(join(root,p),'utf8'));
validatePolicy(json('config/policy.json'));
validateSnapshot(json('fixtures/snapshot.json'),'2026-10-18T12:00:00Z');
const c=json('_corpus/manifest.json');
if(createHash('sha256').update(readFileSync(join(root,'_corpus',c.file))).digest('hex')!==c.sha256)throw new Error('corpus_integrity_failed');
if(existsSync(join(root,'contracts/manifest.json'))){
  for(const entry of json('contracts/manifest.json').artifacts){
    if(createHash('sha256').update(readFileSync(join(root,entry.path))).digest('hex')!==entry.sha256)throw new Error(`contract_digest_mismatch:${entry.path}`);
  }
  const expected=buildReport(json('fixtures/snapshot.json'),json('config/policy.json'),'2026-10-18T12:00:00Z',c.sha256);
  if(JSON.stringify(expected)!==JSON.stringify(json('contracts/example-report.json')))throw new Error('frozen_example_drift');
  // The protocol envelope the same run would send to Control Center, frozen beside the private report.
  const envelope=engineReport(expected,{runId:protocolRunId('run',expected.observed_at,expected.run_id.slice(3,19))});
  if(JSON.stringify(envelope)!==JSON.stringify(json('contracts/example-engine-report.json')))throw new Error('frozen_engine_example_drift');
}
let files=0;
function walk(dir){for(const f of readdirSync(join(root,dir),{withFileTypes:true})){
  if(['.git','runtime','node_modules'].includes(f.name))continue;
  const path=join(dir,f.name);if(f.isDirectory()){walk(path);continue;}
  const body=readFileSync(join(root,path),'utf8');
  if(/\.(mjs|json|md|yml)$/.test(path)){
    // Patterns require credential shape, never a symbolic environment name. Values are never printed.
    if(/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{30,}|lgk_[A-Za-z0-9]{24,}|gen1_[A-Za-z0-9_-]{43,})\b/.test(body))throw new Error(`credential_shape_detected:${path}`);
    if(!path.startsWith('_corpus')&&body.includes('\u2014'))throw new Error(`em_dash:${path}`);
  }
  if(path.endsWith('.mjs')){const r=spawnSync(process.execPath,['--check',join(root,path)],{encoding:'utf8'});if(r.status!==0)throw new Error(`syntax_failed:${path}`);files++;}
}}
walk('');
for(const path of ['docs/BRIEF.md','docs/OPERATIONS.md','docs/CONTROL-CENTER-HANDOFF.md','docs/SOURCE-REGISTER.md','README.md'])if(!existsSync(join(root,path)))throw new Error(`required_document_missing:${path}`);
console.log(`PASS: ${files} executable files parse; policy, snapshot, corpus digest, source privacy scan and required documents checked.`);
