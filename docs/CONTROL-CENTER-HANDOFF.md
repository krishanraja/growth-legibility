> **Superseded on 2026-10-18** by [`docs/CONTROL-CENTER-BRIEF.md`](CONTROL-CENTER-BRIEF.md): Control Center now runs one protocol for every growth engine. Kept for its history.

# Legibility growth engine: Control Center integration handoff

## Delivery status and boundary

This repository builds the Legibility growth engine and its reporting producer. The Control Center consumer described below is **proposed work in `KrishanRaja/control-center`**. It was not implemented, deployed, configured or exercised against production by this repository. A generated report, a local test or a successful synthetic run is not proof of a live Control Center integration or of growth.

Control Center remains the private operational truth. Its Supabase tables hold accepted runs, current status, reports and any work that needs a human decision. The engine's local SQLite store is a transport outbox and attempt ledger, not a CRM or a competing operational database. Agent output does not go unattended into Google Drive.

Do not activate delivery until the receiver implements the capabilities, write and independent readback contracts in this document. Do not point this engine at an existing write route merely because it accepts a bearer.

## Evidence reviewed

The following observations were read from GitHub on **18 October 2026, approximately 14:13 UTC**, pinned to Control Center main revision **`135ccff234c2e68dd283a16e832edfdf005bb351`**. The local Control Center checkout was behind main and was not used as current evidence. No Control Center files, runtime tables, credentials, deployments or external state were changed during this inspection.

This is source verification. It does not establish which revision is deployed, the current database schema or contents, current credentials, or the current active agent roster. Recheck these before activation.

| Observed contract | Source evidence | Consequence for this engine |
|---|---|---|
| Agent runs, status and output belong in tables Control Center reads; agents do not report into Drive | [Architecture canon, reporting](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/docs/MINDMAKE_OS_ARCHITECTURE.md#L158-L167) | An accepted delivery must create a visible report and a run record, not leave a file no dashboard reads. |
| Legibility uses `legibility` as its venture, growth, customer and metrics spelling; it is priority 2 | [Portfolio code](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/src/lib/portfolio.ts#L131-L150) | Bind the receiver to `product_slug: "legibility"`. Read live portfolio priority rather than making a second ranking. |
| Product buyers live only in `product_icp`; a missing definition blocks prospecting | [Canon](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/docs/MINDMAKE_OS_ARCHITECTURE.md#L183), [ICP route](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/api/icp.ts), [ICP shape](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/src/lib/icp.ts) | Corpus segments are candidate hypotheses. They do not establish that a canonical buyer definition is live. |
| Current packs route is the makeyourmindup draft surface and upserts on `(pack_date, kind)` | [Packs route](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/api/growth/packs.ts#L10-L41), [upsert](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/api/growth/packs.ts#L53-L64) | Do not upload Legibility reports to `/api/growth/packs`. It has no product isolation. |
| Pack parser discards unknown product fields and stamps `source: "codex"` | [Parser](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/src/lib/growthPacks.ts#L221-L264) | Adding `product_slug` to a packs request does not prevent a cross-product overwrite. |
| Agent detail reads existing agents, tasks, recent runs and plan; plan PATCH and brief POST use dashboard authorization | [Agent route](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/api/agents/%5Bname%5D.ts), [brief route](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/api/sync-brief.ts) | Neither is a general machine report receiver. The proposed engine bearer must not inherit dashboard authority. |
| Agent references use immutable lowercase slugs; Maya owns customer acquisition and SEO | [Roster contract](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/docs/engineering/AGENT-ROSTER.md#L59-L91), [Maya](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/docs/engineering/AGENT-ROSTER.md#L181), [activation](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/docs/engineering/AGENT-ROSTER.md#L227-L235) | Register the engine as a job under the existing Maya owner after verifying her live row. Do not silently create a new agent. |
| `workflow_runs` uses the current run fields; cron wrappers distinguish work that ran from refused or dry requests | [Database documentation](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/docs/engineering/DATABASE.md#workflow_runs), [cron run implementation](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/api/_cronRun.ts#L94-L126) | Record completed engine work with its real outcome, duration and mode. An authentication refusal is not a successful growth run. |
| Attribution ingest's application allowlist omits Legibility | [Allowlist](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/warehouse/functions/ingest-attribution/index.ts#L21-L30) | Existing ingest does not accept `app: "legibility"` on the inspected revision. An OS-owned extension is required. |
| Attribution wrapper can return HTTP 200 while individual events fail | [Ingest results](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/warehouse/functions/ingest-attribution/index.ts#L104-L122) | Check `accepted` and each result, then read downstream aggregates; HTTP 200 alone is insufficient. |
| Current canon permits a draft to an unknown person only when grounded in rich, specific knowledge; Krish sends | [Current rules](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/docs/MINDMAKE_OS_ARCHITECTURE.md#L82-L93), [contact canon](https://github.com/KrishanRaja/control-center/blob/135ccff234c2e68dd283a16e832edfdf005bb351/docs/MINDMAKE_OS_ARCHITECTURE.md#L146-L156) | Generic sequences and automatic sends do not become authorized by this growth engine. Founder visibility remains an unresolved decision if a motion depends on it. |

The architecture's note that Legibility's ICP was undefined is a dated observation, not a live database read in this build. The activation checklist must establish its current state.

## Proposed receiver contract, version 1.0.0

All routes below are **proposed** and must be built in Control Center before live delivery. The engine client must require the exact capability values, validate responses, and confirm independent readback before acknowledging its outbox record.

### Authorization and target binding

The engine reads its receiver credential at execution time through the symbolic environment interface `LEGIBILITY_CC_TOKEN`. A value is never committed, printed or included in a report. Control Center configures the corresponding dedicated receiver credential through its approved managed secret mechanism.

Send `Authorization: Bearer <runtime credential>` on all three machine routes. The server compares credentials safely, fails closed when unconfigured, limits request size and rate, and returns no permissive browser CORS headers. This credential authorizes only Legibility capabilities, report ingestion and report readback. It grants no dashboard session, arbitrary table write, campaign send, publication, billing, cross-product report, agent creation or human-decision authority.

The server binds `engine_id` and `product_slug` to the route and credential. Reject a body that asks to report for a different engine or product. Verify the intended repository, deployed Control Center project and domain, private data store and production revision together before configuring a real target. Do not copy infrastructure identifiers into this handoff.

### 1. Capabilities

`GET /api/growth/engines/legibility/capabilities`

Required response:

```json
{
  "schema_version": "1.0.0",
  "engine_id": "growth-legibility",
  "product_slug": "legibility",
  "idempotency": true
}
```

The client must refuse delivery for a mismatch, absent field, malformed response or unsuccessful status. A generic health page or HTML login response is not capability proof.

### 2. Report write

`POST /api/growth/engines/legibility/reports`

Headers:

```text
Authorization: Bearer <runtime credential>
Content-Type: application/json
Idempotency-Key: <report run_id>
```

The exact top-level report envelope is:

```text
{
  schema_version: "1.0.0",
  engine_id: "growth-legibility",
  product_slug: "legibility",
  run_id: string,
  mode: "live" | "synthetic",
  observed_at: ISO-8601 UTC timestamp,
  source: {
    snapshot_id: string,
    snapshot_sha256: SHA-256 hex digest,
    captured_at: ISO-8601 UTC timestamp,
    app_revision: string,
    corpus_sha256: SHA-256 hex digest
  },
  status: "ready" | "held" | "degraded",
  scorecard: {
    mode: "live" | "synthetic",
    measured_at: ISO-8601 UTC timestamp,
    campaign: activation state, exact bounds, targets and unknown-aware target progress,
    north_star: source-pinned usage, production-agent and revenue target metadata,
    metrics: engine-generated metric records,
    funnel: engine-generated funnel analysis,
    channels: engine-generated channel analysis,
    benchmark: engine-generated benchmark evidence,
    tripwires: engine-generated tripwire results,
    recommendation: engine-generated recommendation
  },
  actions: engine-generated action records,
  holds: engine-generated hold records,
  opportunities: engine-generated opportunity records,
  payload_sha256: SHA-256 hex digest
}
```

This notation describes field types; it is not an example live report. The engine's validated generated report supplies the concrete inner shapes and values. The Control Center implementation must share or port the repository's report validation contract and fixtures, reject incompatible types and unexpected top-level fields, and pin that contract in tests. Do not weaken an array or object to arbitrary text in transit.

Use `contracts/manifest.json` to pin the executable validator, policy, snapshot fixture and full `contracts/example-report.json` by digest. The example is explicitly synthetic and must only be used in a test consumer. The authenticated snapshot exporter must bind approved ICP evidence to `product_slug: "legibility"`, `source: "control-center:product_icp"`, a nonempty `buyer_definition`, current review time and canonical row revision. A locally asserted status flag cannot substitute for the source-owned read.

Compute `payload_sha256` over the UTF-8 serialization of the report with the **top-level `payload_sha256` field omitted**. Canonicalize JSON by recursively sorting object keys and removing insignificant whitespace; preserve array order, use JSON finite numbers, and preserve string contents without Unicode normalization. Both sides must use the same canonicalization and cross-language fixtures. The server recomputes the digest rather than trusting the submitted value. It verifies the header key equals the body `run_id`.

Required successful POST response:

```text
{ accepted: true, run_id: <exact run_id>, payload_sha256: <recomputed digest> }
```

Idempotency behavior:

| Condition | Required behavior |
|---|---|
| New engine/run ID with a valid report | Atomically store the report and its required run/status projections, then return the acknowledgement. |
| Same engine/run ID and identical digest | Return the same accepted acknowledgement without adding another run, task, report, metric or side effect. |
| Same engine/run ID and different digest | Return a conflict, preferably HTTP 409. Keep the accepted report immutable. |
| Wrong engine, product, schema, mode, digest or body types | Reject before any projection. |
| Missing or invalid receiver credential | Reject without storing the payload or logging its authorization header. |
| Failed transaction or unavailable database | Return failure. Do not acknowledge an incomplete report. |

Treat a timeout after POST as an unknown outcome. Read the run back before retrying; retries always reuse the identical run ID and payload. A changed report gets a new run ID.

### 3. Independent accepted-report readback

`GET /api/growth/engines/legibility/reports/:run_id`

Required successful response:

```text
{ accepted: true, run_id: <stored exact run_id>, payload_sha256: <stored digest> }
```

This read must come from the accepted persistent record, not the prior request body or a client-side cache. Return a clear not-found response for an unaccepted run. Use `Cache-Control: no-store`. The producer marks an outbox record delivered only when the POST acknowledgement and this readback both match the submitted run ID and digest. A 2xx status, `ok: true`, or an echoed body alone is not proof.

## Control Center storage and presentation work

1. Add a private report home for this engine, using an additive, reviewed migration in the Control Center repository. A generic `growth_engine_reports` table is one possible implementation; the exact table name is an OS-owner decision. Keep a unique key on `(engine_id, run_id)`, an immutable payload digest, validated report JSON, mode, observation time and server acceptance time. Do not reuse the unscoped packs key.
2. Deny browser-public and unauthenticated reads and writes. The receiver owns writes through the server's existing data access mechanism. The growth engine never receives Control Center's database service-role credential.
3. Register an identifiable job under the existing Maya owner after confirming the live `agents.id = "maya"` row and its status. Use a stable workflow ID such as `growth-legibility`, a display name, cadence and stale-run expectation. This does not automatically create, rename, activate or change an agent.
4. On an accepted live run, write one `workflow_runs` projection with `workflow_id`, `workflow_name`, `agent_id: "maya"`, `run_at`, `duration_ms` when measured, `status`, `outcome`, optional measured `cost_usd`, `error_message` when applicable, and safe `metadata` containing engine/run/product/mode/digest identifiers. Keep engine report statuses (`ready`, `held`, `degraded`) separate from workflow statuses (`running`, `success`, `error`). A successful analysis that reports a business hold is not an execution error. Do not invent duration or cost.
5. Update Maya's relevant status/output projection without moving its last-run timestamp backwards when an older run arrives late. Confirm existing trigger behavior before adding duplicate stamp logic. A report cannot claim that another agent or job executed.
6. Render the newest accepted **live** Legibility scorecard on the Growth product surface, plus source freshness, holds, the actual next action and a link to the complete report. Make it inspectable beside previous live reports. Unknown metrics must show why they are unknown, not zero. Do not replace authoritative Stripe, analytics or app data with a model's number.
7. Isolate synthetic reports. They may be retained for an integration test if explicitly supported, but must never update live metrics, funnel cohorts, revenue, agent freshness, production recommendations or the human waiting queue. The server enforces this even if a client sends a plausible synthetic value.
8. An action proposal stays a proposal. If a real decision needs Krish, route it through the existing work-board/one-list rules, with an actionable link and an observable close condition. Do not manufacture tasks for every opportunity, silently create goals or mark a decision approved.
9. Record redacted receiver errors and stale-run health on an existing Control Center operational surface. Preserve pull-only behavior; integration failure does not authorize email, Telegram, social posting or another contact channel.

These are receiver acceptance requirements, not a claim that the producer already controls these tables or surfaces.

## Upstream application and measurement prerequisites

The growth engine consumes observations; it cannot make an unwired application funnel measured merely by generating a scorecard. Before treating a run as live growth evidence, the Legibility application owner must provide a verified exporter or equivalent approved source that meets the engine's snapshot input contract.

Required app-side proof:

- A versioned snapshot with capture time, application revision, source identity, stable event identifiers and enough timestamps to compute the declared funnel and retention windows.
- Explicit distinction between real customer activity and founder, QA, seed, bot or synthetic activity. Exclude the latter from live acquisition, activation, retention and revenue claims.
- Measured product events for the engine's funnel, including the first successful product use and repeat value. A page visit, API key creation or signup alone must not stand in for verified activation.
- Attribution carried through the customer journey using stable campaign/source identifiers and dedupe keys. Evidence of a click is not evidence of a paying customer.
- Revenue reconciled to the authoritative billing source, including time window, currency, refunds and subscription state where relevant. Keep dollars, cents and currencies explicit.
- A minimized export with no credentials, full customer payloads or unnecessary identifying details. Keep private source data outside Git; store only safe fixtures and the authorized corpus in this repository.
- End-to-end readback that the app's exporter produces valid engine input from actual source records. This build's local fixtures do not establish that an app exporter exists or is connected.

For the shared attribution warehouse, Control Center is the sole schema/function owner. Its inspected edge function currently rejects Legibility at the application allowlist. The OS owner must review and extend the deployed allowlist, corresponding database constraints and read models before an app emitter can use `app: "legibility"`. Verify the deployed function and live schema, because the repository's old initial migration and current function have different supported-app lists. Do not copy an old deployment instruction or infer an infrastructure target from a similar name.

Attribution event authentication is a separate interface from this reporting bearer. Keep those credentials and responsibilities separate. Validate event-level acceptance and a downstream aggregate; the current ingest response can contain `accepted: 0` in an HTTP 200 envelope.

The corpus's bootstrap, benchmark or testbench suggestions are hypotheses until implemented and proven. Any bootstrap fixture or simulated benchmark run must remain visibly synthetic. Before making a speed, quality, coverage, conversion or superiority claim, the relevant app testbench must record its reproducible inputs, comparator, app revision, collection time, observed outputs and failure cases. An engine recommendation or a sample dataset is not a completed product benchmark.

## Canonical ICP gate

Before prospecting or generating person-specific outreach actions, obtain a current approved read of Legibility's canonical `product_icp` row. The existing `/api/icp` route is a dashboard-authorized reader/editor, not an engine bearer endpoint. The receiver owner must provide a narrow approved read path or a provenance-bearing export; do not give the engine a dashboard access code to bypass that boundary.

The canonical shape includes `venture`, `buyer_titles`, `seniorities`, `geos`, `who`, `who_not`, `company_shape`, `buying_trigger`, `notes`, generated `defined`, `updated_at` and `updated_by`. In the inspected implementation, `defined` requires buyer titles and a who line. The database generates it; the engine must not self-certify a candidate ICP as accepted.

When the current approved row is absent, undefined or unavailable, hold prospecting and say why. Analysis, measurement repair and proposed segment research can continue. Neither the attached corpus nor a saved candidate file updates the canonical row. A rich-context outreach draft also requires evidence about the person and company; generic list sequences remain outside the current rule, and sending or publishing requires Krish's action.

## Activation and acceptance checklist

The Control Center owner can execute this sequence after the concrete receiver change is reviewed and the necessary external actions are authorized:

1. Re-read current main, deployed revision, target identities, live relevant schema, Maya's row and Legibility's canonical ICP. Record retrieval times. Resolve drift from the pinned evidence above before applying anything.
2. Implement the additive receiver migration, strict validator, dedicated bearer gate, product binding, idempotent transaction and persistent readback. Add the Growth report view and operational stale-run visibility. Preserve existing packs and reporting contracts.
3. Run receiver contract tests against safe fixtures: wrong product, wrong engine, schema mismatch, missing credential, bad digest, header/body key mismatch, invalid JSON types, replay, conflicting replay, late run, transaction failure and response tampering.
4. Prove synthetic isolation independently: submit a synthetic report to the allowed test target, read it back, and show that no live metric, freshness timestamp, production recommendation, customer, revenue row or waiting item changed.
5. Test transport failure recovery with the producer: capability refusal; unavailable endpoint; POST accepted but response lost; duplicate retry; mismatched acknowledgement; readback missing; readback digest mismatch; and successful durable readback. Pending attempts must remain recoverable and must never be mistaken for delivery.
6. Implement or verify the upstream app exporter and safe live data boundary. If attribution is included, extend the OS-owned warehouse acceptance path and prove event-level and aggregate readback. Demonstrate the app benchmark/testbench separately before publishing its claims.
7. Obtain the current canonical ICP through the approved narrow path. Confirm undefined/unavailable state blocks prospecting. Treat the corpus's buyer proposal as provisional until the canonical owner accepts it.
8. Configure the approved runtime target and narrow credential through secure managed injection. Do not write a credential to source, command output, report, issue, PR or chat. The producer's `LEGIBILITY_CC_TOKEN` interface names the dependency, not an already-provisioned secret.
9. Deliver one real, minimized, validated live report with a unique run ID. Check its POST acknowledgement and independent stored digest, the Growth view, exactly one corresponding run, correct Maya ownership, correct product, timestamps, source freshness and truthful metric gaps. Re-send the identical payload and verify all counts remain unchanged.
10. Enable the agreed schedule only after those proofs and the separate activation authority exist. Run once under the actual scheduler identity and verify the same accepted report/run evidence. A workflow file alone does not establish a scheduled service is live.

Completion evidence should contain the deployed source revision, schema/migration revision, capability response, redacted report/run identifiers, stored payload digest, accepted and duplicate-run counts, synthetic-isolation check, observed Growth rendering, upstream snapshot provenance, canonical ICP status and scheduler readback. Never include credentials or private customer identities.

## What remains outside this repository

- The proposed Control Center receiver, schema migration, private Growth rendering and live owner/job registration.
- Provisioning, permission changes, push/merge/deploy and scheduler activation in the external systems.
- Live canonical ICP acceptance and its approved engine read path.
- Legibility application instrumentation/exporter wiring, live attribution warehouse enablement and independent benchmark/testbench implementation.
- Any publication, outreach send, spend or claim of real customer growth.

The next executable handoff is to implement and test this receiver in the Control Center repository, using the producer's report validator and transport fixtures as the shared contract, then close the activation checklist with observed evidence.
