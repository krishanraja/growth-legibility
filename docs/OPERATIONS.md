# Operate the producer

## Install and baseline

Use Node 24+ and npm ci. Run doctor, check, test, conveyor and demo. The demo is offline and synthetic. Never copy its counts into live growth reporting. No populated credential file, private snapshot or runtime report belongs in Git or CI artifacts.

The canonical private source owner supplies a complete snapshot matching fixtures/snapshot.json and contracts/README.md. mode=live is an assertion by that authenticated exporter, not a way to upgrade synthetic evidence. The consumer must independently establish source ownership and coverage before accepting it.

Coverage flags must reflect full pagination and reconciliation. Missing sources are false, even when their arrays are empty. A complete empty source measures zero; unavailable data measures null. Usage events come from server metering rather than client first_trusted_read assertions. Every actual call must carry the product-present flag, confidence and calibration. Account canonical_id is explicit identity evidence from the owner, never a name/email guess by this engine.

## Cycle

1. Export source-owned accounts, server reads, events, canonical ICP, private candidate evidence, contact/suppression state, partner distribution, feedback, settled payments and actual source coverage. Protect the export under runtime/input/.
2. Run `node src/cli.mjs run --snapshot runtime/input/snapshot.json --out runtime/live`. Inspect the emitted mode, status, unknown reasons, recommended constraint and pending actions in the private report.
3. Source gaps, overdue reviews, partial windows, stale live snapshots and detected paid media hold actionable work. Repair the owning source rather than editing the output to look successful.
4. Deliver through the Control Center growth engine protocol: `node src/cli.mjs deliver --run-id CONTROL_CENTER_RUN_ID --out runtime/live`, with `CONTROL_CENTER_ENGINE_TOKEN` injected at run time. The outbox holds the protocol envelope, not the private report. Do not point the engine at growth/packs, dashboard APIs or a generic table-write endpoint.
5. Confirm the matching stored digest, then the run on Growth > Engines. The engine's delivered status proves only the digest readback; dashboard projection is Control Center's to verify.

## Approval and suppression

Drafts and distribution assets are written and reviewed under [COPY-DOCTRINE.md](COPY-DOCTRINE.md): awareness-matched lead, one promise and one action, cited proof, no invented urgency or warmth, and the adapted rubric before handoff. The doctrine guides the writer; it grants no approval. Only exact supplied, checked drafts become pending_human packets. The engine can return specific research, source-lineage or draft-production work without fabricating prose. Each pending packet binds candidate, channel, exact text hash and source revision. It expires after 48 hours. The private consumer must re-read the current ICP, source evidence, global suppression and contact history immediately before human review and execution.

A work_required task is not an outbound approval. An old approval flag in input grants no authority. No endpoint in this repository sends, publishes, spends or approves. The human acts from the exact reviewed destination, using their existing approved tools. The source owner records observed delivery and reply outcomes for the next run.

## Recovery

Use `node src/cli.mjs status --run-id RUN_ID --out runtime/live` to see pending, uncertain or delivered and the durable attempt count. Re-run deliver with the same run ID to reconcile. It always GETs the stored digest before any new POST. If an earlier POST persisted but its response was lost, reconciliation acknowledges the existing write and consumes no further POST.

An absent authoritative readback allows a bounded idempotent retry once any existing 120-second reservation has expired. An unavailable or mismatched readback does not. Three attempts survive process restarts; repeated invocations never renew that budget. Investigate exhausted delivery with the Control Center owner rather than deleting the journal or changing the run clock to bypass it. Concurrency uses atomic local reservations fenced by their durable attempt generation, plus server idempotency. A stale resumed process cannot clear a newer reservation. The consumer must enforce uniqueness on run_id and reject digest conflicts transactionally.

Restore an older producer through normal Git review if code fails. Reproduce private reports from their original source, policy, observed_at and corpus digest. Retain source revisions with the source owner. Preserve uncertain outbox rows until authoritative reconciliation. Never delete business records as a recovery technique.

## Operating cadence and useful work

The daily run is Control Center's dispatch (below). No other schedule is enabled. The corpus's five London-time moments are suggested work stages, not five required full runs. Keep one active material acquisition experiment, maximum five new approval/work items per run, one human-reviewed follow-up and zero paid media.

Review activation and mature return by source before reach. Work through the minimum-sample tripwires; do not rewrite strategy from tiny denominators. Review honest coverage and high failure methods before adding distribution. Only consented aggregate benchmark evidence can become a public draft, and publication remains a separate approved action.

A production agent flag must be supported by actual deployment evidence retained in the source owner. Sepolia amounts are testnet volume, never revenue. Convert settled amounts to USD using source-owned dated rates before export, remove failed settlement, and reconcile signup revenue including refunds. The engine does not call Stripe or a wallet.

## The Control Center loop

Control Center sends a `cc-growth-directive` repository dispatch at about 05:10 UTC each day; `workflow_dispatch` runs the same job by hand. `.github/workflows/operate.yml` checks out the code with read-only permissions, runs `npm run check`, then `node src/cli.mjs operate`. One job runs at a time, for at most 15 minutes, and nothing from `runtime/` is uploaded.

| Step | Route under `/api/growth/engines/legibility/` | What the engine does |
|---|---|---|
| 1 | `POST attempts` | Journals `started` with its attempt and run id, before reading any source. Without a journaled start, nothing else runs |
| 2 | `GET directive` | Pulls the next action, objectives and recent decisions. If it cannot be read, the run continues inside the walls and holds `directive_unavailable` |
| 3 | none | Runs the engine. With `--snapshot` it measures and prepares as in the cycle above; without one it builds a held report that measures nothing |
| 4 | `GET capabilities`, `GET reports/<run_id>`, `POST reports`, `GET reports/<run_id>` | Compares schema_version, engine_id and product_slug; reconciles; posts once with `Idempotency-Key`; reads the stored digest back |
| 5 | `GET decisions?since=` | Counts approvals whose `payload_sha256` equals a payload from this run. It never acts on them |
| 6 | `POST attempts` | Closes the attempt: `succeeded`, `failed` with a lower_snake code, or `unknown` when a response was lost |

The run id is `legibility:<UTC date>:operate:gh<run>.<attempt>`, so a rerun is a new run rather than a conflict. The attempt id is the same string. A 409 on the report is read back and never retried blindly; a 401 fails the attempt as `receiver_unauthorized`. The printed summary carries codes, counts and digests only, because Actions logs on this public repository are public.

### What a dispatch can measure today

The runner has no source snapshot from the app and no canonical ICP, so every dispatch today reports `status: held`, with `activated`, `returning` and `net` all `missing` and the reason, and holds `source_snapshot_missing` and `icp_not_current_approved`. Its one proposal, inside the walls, is to connect the snapshot export and the `product_icp` read path. Even with a snapshot, the three objectives stay `missing` until the campaign clock is activated in `config/policy.json`, because there is no campaign window to count in. Once both exist, the objectives report measured counts: builders with a first trusted read, mature seven-day returning builders, and qualified Founding members.

### Mapping

| Producer output | Protocol envelope |
|---|---|
| Campaign target metrics | `objectives[]`: `activated` from first trusted reads, `returning` from seven-day returning, `net` from qualified enrolments, UTC, in the campaign window |
| Other scorecard lines | `activity[]` in plain words, with no names or private URLs |
| `pending_human` approval packet | Proposal with `wall: send`, `exact_payload` from `exact_text`, `payload_sha256` from `text_sha256`, `expires_at` kept; the id binds the prospect and channel |
| `work_required` task, recommended constraint | Proposal with `wall: none` (activating the campaign clock is `wall: strategy`, a ruling for Krish) |
| `opportunities[]` | One activity line; the uncovered ones already arrive as work proposals |
| `holds[]` | `holds[]`, one per code, with the engine's own next step as the detail |
