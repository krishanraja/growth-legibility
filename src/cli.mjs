import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { buildReport, engineReport, protocolRunId, publicSummary, loadJson } from './orchestrator.mjs';
import { validatePolicy } from './guards/wire.mjs';
import { Outbox } from './outbox.mjs';
import { APPROVED_ORIGIN, controlCenter, deliver } from './transport.mjs';
import { operate } from './operate.mjs';
import { exportFromEnv } from './lib/export-client.mjs';
import { dropPriorMindmake } from './lib/prior-outreach.mjs';
import { heldReport, readActivation } from './lib/hold.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)),'..');
function args(argv) {
  const out = {command:argv[0]??'help'};
  for (let i=1;i<argv.length;i++) {
    if (!/^--[a-z-]+$/.test(argv[i]) || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error('invalid_cli_arguments');
    const key=argv[i].slice(2);
    if (key in out) throw new Error('duplicate_cli_argument');
    out[key]=argv[++i];
  }
  const allowed={run:['snapshot','policy','at','out'],operate:['snapshot','policy','out'],deliver:['run-id','out'],status:['run-id','out'],doctor:[],help:[]};
  if (!(out.command in allowed)||Object.keys(out).some(k=>k!=='command'&&!allowed[out.command].includes(k))) throw new Error('unknown_cli_option');
  return out;
}
// Credentials and the target come from the runtime environment only, and are never printed.
function credentials() {
  const token=process.env.CONTROL_CENTER_ENGINE_TOKEN, base=process.env.CONTROL_CENTER_URL||APPROVED_ORIGIN;
  if(!token) throw new Error('control_center_engine_token_missing');
  return {token,base};
}
// A dispatch names its engine and directive. Both are untrusted input: checked, never interpolated into a shell.
function dispatch() {
  const engine=process.env.CC_ENGINE_ID, directive=process.env.CC_DIRECTIVE_ID;
  if(engine&&engine!=='growth-legibility') throw new Error('dispatch_engine_mismatch');
  const date=/^legibility:(\d{4}-\d{2}-\d{2})$/.exec(directive??'')?.[1]??null;
  if(directive&&!date) throw new Error('dispatch_directive_invalid');
  const run=process.env.GITHUB_RUN_ID, attempt=process.env.GITHUB_RUN_ATTEMPT;
  const invocation=/^\d{1,20}$/.test(run??'')&&/^\d{1,6}$/.test(attempt??'')?`gh${run}.${attempt}`:`local${randomBytes(6).toString('hex')}`;
  const revision=/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA??'')?process.env.GITHUB_SHA:'unversioned-local';
  return {date,invocation,revision};
}
function writeJson(path,value) { writeFileSync(path,`${JSON.stringify(value,null,2)}\n`,{mode:0o600}); }
function corpus() {
  const register = loadJson(join(root,'_corpus','manifest.json'));
  // Hash actual bytes, including the original line endings.
  const bytes=readFileSync(join(root,'_corpus',register.file));
  return {register,bytes};
}
// Every preserved reference source must match its registered bytes. None of them is execution authority.
function verifySources(register,createHash) {
  const sources=register.sources??[{file:register.file,sha256:register.sha256,received_at:register.received_at}];
  if(!sources.some(s=>s.file===register.file&&s.sha256===register.sha256&&s.received_at===register.received_at)) throw new Error('corpus_primary_unlisted');
  if(new Set(sources.map(s=>s.file)).size!==sources.length) throw new Error('corpus_duplicate_source');
  for(const s of sources) {
    if(!/^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/.test(s.file??'')||!/^[a-f0-9]{64}$/.test(s.sha256??'')) throw new Error('corpus_source_invalid');
    const bytes=readFileSync(join(root,'_corpus',s.file));
    if((s.bytes!==undefined&&bytes.length!==s.bytes)||createHash('sha256').update(bytes).digest('hex')!==s.sha256) throw new Error(`corpus_integrity_failed:${s.file}`);
  }
  return sources.map(s=>({file:s.file,received_at:s.received_at,integrity:'pass'}));
}
async function main() {
  const opts=args(process.argv.slice(2));
  const policy=loadJson(opts.policy?resolve(opts.policy):join(root,'config','policy.json'));
  validatePolicy(policy);
  const {createHash}=await import('node:crypto');
  const c=corpus();
  const corpusSha=createHash('sha256').update(c.bytes).digest('hex');
  if(corpusSha!==c.register.sha256) throw new Error('corpus_integrity_failed');
  const corpusSources=verifySources(c.register,createHash);
  if(opts.command==='doctor') {
    console.log(JSON.stringify({node:process.version,corpus_integrity:'pass',corpus_sources:corpusSources,policy:'pass',source_review_due:policy.source_review_due,activation:readActivation(join(root,'config','activation.json')),
      campaign_activation:policy.campaign.activated_at??'not activated',receiver:'Control Center growth engine protocol 1.0.0, or 1.12.0 when it serves the Draft press',credentials:{control_center_token:Boolean(process.env.CONTROL_CENTER_ENGINE_TOKEN),control_center_url:Boolean(process.env.CONTROL_CENTER_URL),product_api:Boolean(process.env.LEGIBILITY_API_KEY),legibility_export_url:Boolean(process.env.LEGIBILITY_EXPORT_URL),legibility_export_token:Boolean(process.env.LEGIBILITY_EXPORT_TOKEN)}},null,2));
    return;
  }
  if(opts.command==='help') {
    console.log('run --snapshot FILE [--policy FILE] [--at ISO] [--out runtime/live]\noperate [--snapshot FILE] [--policy FILE] [--out runtime/live]\ndeliver --run-id ID [--out runtime/live]\nstatus --run-id ID [--out runtime/live]\ndoctor\nNo sends, posts, paid calls or schedules are executed. operate and deliver write private reports only to the verified Control Center protocol routes.');
    return;
  }
  // Fail before touching anything when the run cannot reach Control Center at all.
  const client=['operate','deliver'].includes(opts.command)?controlCenter(credentials()):null;
  const plan=opts.command==='operate'?dispatch():null;
  const output=resolve(opts.out??join(root,'runtime','live'));
  // Private runtime must stay inside this ignored spool. Never permit accidental public output.
  const runtimeRoot=resolve(root,'runtime');
  if(output!==runtimeRoot&&!output.startsWith(`${runtimeRoot}\\`)&&!output.startsWith(`${runtimeRoot}/`)) throw new Error('output_must_be_private_runtime');
  mkdirSync(output,{recursive:true,mode:0o700});
  const db=new Outbox(join(output,'outbox.sqlite'));
  try {
    if(opts.command==='run') {
      if(!opts.snapshot) throw new Error('snapshot_required');
      const at=opts.at??new Date().toISOString();
      const activation=readActivation(join(root,'config','activation.json'));
      // Held, a snapshot's own Mindmake record is dropped as operate drops it, so each person holds as unknown.
      const snapshot=activation.state==='active'?loadJson(resolve(opts.snapshot)):dropPriorMindmake(loadJson(resolve(opts.snapshot))).snapshot;
      const report=buildReport(snapshot,policy,at,corpusSha);
      writeJson(join(output,`${report.run_id}.json`),report);
      // The protocol envelope is what the outbox holds and deliver sends; its run_id names the day, command and observation.
      let envelope=engineReport(report,{runId:protocolRunId('run',report.observed_at,report.run_id.slice(3,19))});
      // Krish's own hold (Ruling, Krish, 2026-10-29): held, the envelope the outbox keeps carries no proposal, only the one hold.
      if(activation.state!=='active') envelope=heldReport(envelope,{by:['krish_local'],policy});
      db.put(envelope);
      writeJson(join(output,`${envelope.run_id.replaceAll(':','_')}.envelope.json`),envelope);
      const summary=publicSummary(report);
      writeJson(join(output,'latest-summary.json'),summary);
      console.log(JSON.stringify({...summary,control_center_run_id:envelope.run_id},null,2));
    } else if(opts.command==='operate') {
      const {summary,privateReport}=await operate({client,outbox:db,policy,corpusSha,
        loadSnapshot:opts.snapshot?()=>loadJson(resolve(opts.snapshot)):null,invocation:plan.invocation,revision:plan.revision,directiveDate:plan.date,
        // Krish's own hold (Ruling, Krish, 2026-10-29): a missing or unreadable file reads as held.
        activation:readActivation(join(root,'config','activation.json')),
        // The app export is read only when both variables are set; neither set holds exactly as before (attribution_export_missing).
        appExport:opts.snapshot?{state:'absent'}:exportFromEnv(process.env)});
      if(privateReport) writeJson(join(output,`${privateReport.run_id}.json`),privateReport);
      console.log(JSON.stringify(summary,null,2));
      if(summary.status!=='succeeded'||summary.journal!=='closed') process.exitCode=1;
    } else if(opts.command==='deliver') {
      if(!opts['run-id']) throw new Error('run_id_required');
      // Held by the local flag or by Control Center, a row with proposals is refused before anything is posted.
      console.log(JSON.stringify(await deliver(db,opts['run-id'],{client,activation:readActivation(join(root,'config','activation.json'))}),null,2));
    } else {
      const row=db.get(opts['run-id']??'');
      if(!row) throw new Error('outbox_report_missing');
      console.log(JSON.stringify({run_id:row.run_id,status:row.status,attempts:row.attempts,last_error:row.last_error},null,2));
    }
  } finally { db.close(); }
}
main().catch(e=>{ console.error(/^[a-zA-Z0-9_:.-]+$/.test(e.message)?e.message:'engine_failed_private_details_suppressed'); process.exitCode=1; });
