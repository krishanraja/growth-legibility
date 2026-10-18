import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport, publicSummary, loadJson } from './orchestrator.mjs';
import { validatePolicy } from './guards/wire.mjs';
import { Outbox } from './outbox.mjs';
import { deliver } from './transport.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)),'..');
function args(argv) {
  const out = {command:argv[0]??'help'};
  for (let i=1;i<argv.length;i++) {
    if (!/^--[a-z-]+$/.test(argv[i]) || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error('invalid_cli_arguments');
    const key=argv[i].slice(2);
    if (key in out) throw new Error('duplicate_cli_argument');
    out[key]=argv[++i];
  }
  const allowed={run:['snapshot','policy','at','out'],deliver:['run-id','out'],status:['run-id','out'],doctor:[],help:[]};
  if (!(out.command in allowed)||Object.keys(out).some(k=>k!=='command'&&!allowed[out.command].includes(k))) throw new Error('unknown_cli_option');
  return out;
}
function writeJson(path,value) { writeFileSync(path,`${JSON.stringify(value,null,2)}\n`,{mode:0o600}); }
function corpus() {
  const register = loadJson(join(root,'_corpus','manifest.json'));
  // Hash actual bytes, including the original line endings.
  const bytes=readFileSync(join(root,'_corpus',register.file));
  return {register,bytes};
}
async function main() {
  const opts=args(process.argv.slice(2));
  const policy=loadJson(opts.policy?resolve(opts.policy):join(root,'config','policy.json'));
  validatePolicy(policy);
  const {createHash}=await import('node:crypto');
  const c=corpus();
  const corpusSha=createHash('sha256').update(c.bytes).digest('hex');
  if(corpusSha!==c.register.sha256) throw new Error('corpus_integrity_failed');
  if(opts.command==='doctor') {
    console.log(JSON.stringify({node:process.version,corpus_integrity:'pass',policy:'pass',source_review_due:policy.source_review_due,
      campaign_activation:policy.campaign.activated_at??'not activated',receiver:'requires implementation and live readback',credentials:{control_center:Boolean(process.env.LEGIBILITY_CC_TOKEN),product_api:Boolean(process.env.LEGIBILITY_API_KEY)}},null,2));
    return;
  }
  if(opts.command==='help') {
    console.log('run --snapshot FILE [--policy FILE] [--at ISO] [--out runtime/live]\ndeliver --run-id ID [--out runtime/live]\nstatus --run-id ID [--out runtime/live]\ndoctor\nNo sends, posts, paid calls or schedules are executed. deliver writes a private report only to the verified Control Center receiver.');
    return;
  }
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
      const report=buildReport(loadJson(resolve(opts.snapshot)),policy,at,corpusSha);
      db.put(report);
      writeJson(join(output,`${report.run_id}.json`),report);
      const summary=publicSummary(report);
      writeJson(join(output,'latest-summary.json'),summary);
      console.log(JSON.stringify(summary,null,2));
    } else if(opts.command==='deliver') {
      if(!opts['run-id']) throw new Error('run_id_required');
      console.log(JSON.stringify(await deliver(db,opts['run-id'],{token:process.env.LEGIBILITY_CC_TOKEN}),null,2));
    } else {
      const row=db.get(opts['run-id']??'');
      if(!row) throw new Error('outbox_report_missing');
      console.log(JSON.stringify({run_id:row.run_id,status:row.status,attempts:row.attempts,last_error:row.last_error},null,2));
    }
  } finally { db.close(); }
}
main().catch(e=>{ console.error(/^[a-zA-Z0-9_:.-]+$/.test(e.message)?e.message:'engine_failed_private_details_suppressed'); process.exitCode=1; });
