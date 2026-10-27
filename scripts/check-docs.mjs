// Documentation and register checks. CI only (.github/workflows/ci.yml): a docs defect must never stop the
// daily Control Center run, so operate.yml keeps running `npm run check` alone (docs/FAILURES.md F21).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP = new Set(['.git', 'node_modules', 'runtime', '_corpus']);
const EXAMPLE_DOMAINS = /@(?:[a-z0-9-]+\.)*example\.(?:test|com|org|net)$/i;
// Tools a session in this repository must never be able to call (docs/ENGINE-ARCHITECTURE.md, section 8).
// Whole servers: retired routes and tools placed with other ventures. Single tools: verbs that send, share,
// delete, publish or change an account. Names follow this cloud session's connector names.
export const REQUIRED_DENY = [
  'mcp__Instantly', 'mcp__plugin_sales_apollo', 'mcp__plugin_sales_fireflies', 'mcp__Descript', 'mcp__Buffer', 'mcp__Higgsfield',
  'mcp__Runway', 'mcp__HeyGen', 'mcp__ElevenLabs', 'mcp__Shopify', 'mcp__Riverside',
  'mcp__Gmail__send_message', 'mcp__Gmail__reply', 'mcp__Gmail__forward', 'mcp__Gmail__trash_message',
  'mcp__Gmail__trash_thread', 'mcp__Gmail__delete_draft', 'mcp__Gmail__delete_label',
  'mcp__Google_Drive__share_file', 'mcp__Google_Drive__trash_file',
  'mcp__Canva__publish-brand-template',
  'mcp__Calendly__event_types-create_event_type', 'mcp__Calendly__event_types-update_event_type',
  'mcp__Calendly__event_types-update_event_type_availability_schedule', 'mcp__Calendly__meetings-cancel_event',
  'mcp__Calendly__meetings-create_invitee', 'mcp__Calendly__scheduling_links-create_single_use_scheduling_link',
  'mcp__Apify__call-actor',
  'mcp__Slack__slack_send_message', 'mcp__Slack__slack_schedule_message',
  'mcp__n8n__publish_workflow', 'mcp__n8n__unpublish_workflow', 'mcp__n8n__execute_workflow',
  'mcp__n8n__call_agent', 'mcp__n8n__publish_agent',
];

// Repository-relative paths always use '/', on Windows too: the rules below match on 'specs/' and friends, and
// the errors name a file the same way on every runner (docs/FAILURES.md F28).
function files(root, dir = '', out = []) {
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) files(root, p, out); else out.push(p);
  }
  return out;
}

// Every relative markdown link resolves to a file or directory inside the repository; https links are allowed.
export function checkRelativeLinks(root) {
  const errors = [];
  for (const f of files(root).filter(p => p.endsWith('.md'))) {
    const body = readFileSync(join(root, f), 'utf8');
    for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
      const path = target.split('#')[0];
      if (!path) continue;
      const abs = resolve(root, dirname(f), path);
      const rel = relative(root, abs);
      if (rel.split(/[\\/]/)[0] === '..' || isAbsolute(rel) || !existsSync(abs)) errors.push(`relative_link_unresolved:${f}:${target}`);
    }
  }
  return errors;
}

function testNames(root) {
  const names = new Set();
  const dir = join(root, 'tests');
  if (!existsSync(dir)) return names;
  for (const f of readdirSync(dir).filter(n => n.endsWith('.test.mjs'))) {
    const body = readFileSync(join(dir, f), 'utf8');
    for (const m of body.matchAll(/\btest\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) names.add(`tests/${f} :: ${m[2]}`);
  }
  return names;
}

// docs/FAILURES.md names tests that exist, and every conveyor learning is registered with a named test.
export function checkRegisters(root) {
  const errors = [];
  const register = join(root, 'docs/FAILURES.md');
  if (!existsSync(register)) return ['register_missing:docs/FAILURES.md'];
  const body = readFileSync(register, 'utf8');
  const names = testNames(root);
  const refs = [...body.matchAll(/`(tests\/[A-Za-z0-9._-]+\.test\.mjs) :: ([^`]+)`/g)].map(m => `${m[1]} :: ${m[2]}`);
  for (const r of refs) if (!names.has(r)) errors.push(`register_test_missing:${r}`);
  const conveyor = join(root, 'pipeline/stage-conveyor.json');
  if (existsSync(conveyor)) {
    const rows = body.split('\n').filter(l => l.startsWith('|'));
    for (const l of JSON.parse(readFileSync(conveyor, 'utf8')).learnings ?? []) {
      const row = rows.find(r => r.split('|').map(c => c.trim()).includes(l.id));
      if (!row || !/`tests\/[^`]+ :: [^`]+`/.test(row)) errors.push(`learning_unregistered:${l.id}`);
    }
  }
  return errors;
}

// No real email address anywhere in the repository; reserved example domains are allowed.
export function checkEmails(root) {
  const errors = [];
  for (const f of files(root).filter(p => /\.(?:md|json|mjs|yml|yaml|txt)$/.test(p))) {
    for (const m of readFileSync(join(root, f), 'utf8').matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
      if (!EXAMPLE_DOMAINS.test(m[0])) errors.push(`email_address:${f}`);
    }
  }
  return [...new Set(errors)];
}

// Readiness is computed, never written: no spec, crew or register file carries a hand-written status verdict.
export function checkStatusWords(root) {
  const errors = [];
  for (const f of files(root).filter(p => /^(?:specs|crew|invariants|librarian)\//.test(p) && p.endsWith('.json'))) {
    const walk = (v, path) => {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
        if (/^(?:status|state|verdict|result)$/i.test(k) && typeof x === 'string' && /^(?:pass(?:ed)?|done|ready|complete(?:d)?|ok)$/i.test(x)) errors.push(`written_status:${f}:${path}.${k}`);
        walk(x, `${path}.${k}`);
      }
    };
    walk(JSON.parse(readFileSync(join(root, f), 'utf8')), '$');
  }
  return errors;
}

// The run-session deny list carries every required entry.
export function checkDenyList(root) {
  const p = join(root, '.claude/settings.json');
  if (!existsSync(p)) return ['settings_missing:.claude/settings.json'];
  const deny = JSON.parse(readFileSync(p, 'utf8')).permissions?.deny ?? [];
  return REQUIRED_DENY.filter(t => !deny.includes(t)).map(t => `deny_entry_missing:${t}`);
}

export function checkDocs(root) {
  return [...checkRelativeLinks(root), ...checkRegisters(root), ...checkEmails(root), ...checkStatusWords(root), ...checkDenyList(root)];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const errors = checkDocs(root);
  if (errors.length) { for (const e of errors) console.error(e); process.exit(1); }
  const refs = (readFileSync(join(root, 'docs/FAILURES.md'), 'utf8').match(/`tests\/[^`]+ :: [^`]+`/g) ?? []).length;
  console.log(`PASS: docs checks (relative links, ${refs} registered tests, no email addresses, no written status, ${REQUIRED_DENY.length} deny entries).`);
}
