# Operate the producer

## Install and baseline

Use Node 24+ and npm ci. Run doctor, check, test, conveyor and demo. The demo is offline and synthetic. Never copy its counts into live growth reporting. No populated credential file, private snapshot or runtime report belongs in Git or CI artifacts.

The canonical private source owner supplies a complete snapshot matching fixtures/snapshot.json and contracts/README.md. mode=live is an assertion by that authenticated exporter, not a way to upgrade synthetic evidence. The consumer must independently establish source ownership and coverage before accepting it.

Coverage flags must reflect full pagination and reconciliation. Missing sources are false, even when their arrays are empty. A complete empty source measures zero; unavailable data measures null. Usage events come from server metering rather than client first_trusted_read assertions. Every actual call must carry the product-present flag, confidence and calibration. Account canonical_id is explicit identity evidence from the owner, never a name/email guess by this engine.

## Cycle

1. Export source-owned accounts, server reads, events, canonical ICP, private candidate evidence, contact/suppression state, each candidate's Control Center contact id (`contact.contact_id`) and Mindmake record (`contact.prior_mindmake`, copied unchanged from Control Center's reader; contracts/README.md; `operate` reads it itself by contact id and drops any record the input carried), partner distribution, feedback, settled payments and actual source coverage. Protect the export under runtime/input/.
2. Run `node src/cli.mjs run --snapshot runtime/input/snapshot.json --out runtime/live`. Inspect the emitted mode, status, unknown reasons, recommended constraint and pending actions in the private report. A hand `run` reads nothing from Control Center: no directive, no buyer from `product_icp` (the snapshot's own `icp` decides), no Mindmake record (the snapshot's own `contact.prior_mindmake` decides) and no Draft press, so its envelope is always protocol 1.0.0 with the three original objectives. It differs from what `operate --snapshot FILE` would report on the same snapshot in the runner, which reads all four.
3. Source gaps, overdue reviews, partial windows, stale live snapshots and detected paid media hold actionable work. Repair the owning source rather than editing the output to look successful.
4. Deliver through the Control Center growth engine protocol: `node src/cli.mjs deliver --run-id CONTROL_CENTER_RUN_ID --out runtime/live`, with `CONTROL_CENTER_ENGINE_TOKEN` injected at run time, only where that secret already lives: the runner. No interactive session may hold the engine token (ENGINE-ARCHITECTURE.md, decision 18). The outbox holds the protocol envelope, not the private report. Do not point the engine at growth/packs, dashboard APIs or a generic table-write endpoint.
5. Confirm the matching stored digest, then the run on Growth > Engines. The engine's delivered status proves only the digest readback; dashboard projection is Control Center's to verify.

## Approval and suppression

Drafts and distribution assets are written and reviewed under [COPY-DOCTRINE.md](COPY-DOCTRINE.md): awareness-matched lead, one promise and one action, cited proof, no invented urgency or warmth, and the adapted rubric before handoff. The doctrine guides the writer; it grants no approval. Only exact supplied, checked drafts become pending_human packets. The engine can return specific research, source-lineage or draft-production work without fabricating prose. Each pending packet binds candidate, channel, exact text hash and source revision. It expires after 48 hours. The private consumer must re-read the current ICP, source evidence, global suppression, contact history and the Mindmake record immediately before human review and execution; an unknown, open or client record, or a Mindmake touch under 14 days old, holds. Items a session prepares by hand under stable ids (Wave 0) first pass `npm run check:invitation -- --input runtime/input/<file>.json`, which prints only sha256 prefixes and codes; an item with any code is not resubmitted.

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

Control Center sends a `cc-growth-directive` repository dispatch at about 05:10 UTC each day; `workflow_dispatch` runs the same job by hand. `.github/workflows/operate.yml` checks out the code with read-only permissions, runs `npm run check`, then `node src/cli.mjs operate`. One job runs at a time, for at most 15 minutes, and nothing from `runtime/` is uploaded. The order below is `src/operate.mjs`.

| Step | Request | What the engine does |
|---|---|---|
| 1 | `POST attempts` | Journals `started` with its attempt and run id, before reading any source. Without a journaled start, nothing else runs |
| 2 | `GET directive` | Pulls the next action, objectives and recent decisions (and, from protocol 1.13.0, the buyer and legibility.io's readings). If it cannot be read, the run continues inside the walls and holds `directive_unavailable` |
| 3 | `GET capabilities` | Reads which features Control Center serves. With `features.icp` it takes the directive's buyer (`readIcp`); it records whether the research desk is open (`research`), and asks it nothing before Phase 2 |
| 4 | `GET` the app export, `LEGIBILITY_EXPORT_URL` on `https://legibility.io` | Skipped when a `--snapshot` file is given. Otherwise reads the export (`src/lib/export-client.mjs`) and composes the snapshot; a failure holds with its code |
| 5 | none | A served buyer replaces the snapshot's (`applyIcp`) |
| 6 | `GET prior-outreach?contacts=` | Only with a snapshot, `features.prior_outreach` and at least one candidate with a `contact.contact_id`: copies each person's Mindmake record (contracts/README.md) |
| 7 | `GET capabilities` | Only when a prepared invitation could be a version 2 email action: asks whether the Draft press is served (`features.draft_press` at 1.12.0) |
| 8 | `GET capabilities`, `GET reports/<run_id>`, `POST reports`, `GET reports/<run_id>` | Checks the receiver takes the report's version, engine_id and product_slug; reconciles; posts once with `Idempotency-Key`; reads the stored digest back |
| 9 | `GET decisions?since=` | Counts approvals whose `payload_sha256` equals a payload from this run. It never acts on them |
| 10 | `POST attempts` | Closes the attempt: `succeeded`, `failed` with a lower_snake code, or `unknown` when a response was lost |

Every request in steps 1 to 3 and 6 to 10 goes to `/api/growth/engines/legibility/` on `CONTROL_CENTER_URL`, on the engine's own bearer. The run id is `legibility:<UTC date>:operate:gh<run>.<attempt>`, so a rerun is a new run rather than a conflict. The attempt id is the same string. A 409 on the report is read back and never retried blindly; a 401 fails the attempt as `receiver_unauthorized`. The printed summary carries codes, counts and digests only, because Actions logs on this public repository are public.

### Environment

Every value is read at run time and never printed or written. `.env.example` lists the names for a local run.

| Name | Kind | Default | Read by |
|---|---|---|---|
| `CONTROL_CENTER_ENGINE_TOKEN` | Actions secret | none: `operate` and `deliver` stop with `control_center_engine_token_missing` before any request | `src/cli.mjs` (`credentials`); `operate.yml` also passes it as the export bearer until `LEGIBILITY_EXPORT_TOKEN` exists (FAILURES F44) |
| `CONTROL_CENTER_URL` | Actions variable | `https://controlcenter.krishraja.com`, the only origin `src/transport.mjs` calls | `src/cli.mjs`, `src/transport.mjs` |
| `LEGIBILITY_EXPORT_TOKEN` | Actions secret, optional | in `operate.yml`, `CONTROL_CENTER_ENGINE_TOKEN`; elsewhere unset | `src/lib/export-client.mjs` (`exportFromEnv`) |
| `LEGIBILITY_EXPORT_URL` | Actions variable, optional | in `operate.yml`, `https://legibility.io/api/internal/growth/export`; elsewhere unset | `src/lib/export-client.mjs` (`exportFromEnv`), pinned to `https://legibility.io` |
| `CC_DIRECTIVE_ID`, `CC_ENGINE_ID` | from the dispatch payload, set by `operate.yml` | absent on a hand run | `src/cli.mjs` (`dispatch`), checked as untrusted input |
| `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `GITHUB_SHA` | set by Actions | a random local invocation id and `unversioned-local` | `src/cli.mjs` (`dispatch`), for the run id and the held report's revision |
| `LEGIBILITY_API_KEY` | unused | none | nothing runs on it; `doctor` only says whether it is set |
| `ANTHROPIC_API_KEY` | Actions secret, Phase 2 | not added yet | nothing yet: Phase 2's drafting step (ENGINE-ARCHITECTURE.md, decision 18) |

With neither export variable set, the run is unchanged and its summary names `attribution_export_missing`; with one set alone it holds as `attribution_export_incomplete`.

### What a dispatch measures today (28 October 2026)

This paragraph is the one home for what a live run reports; other documents link here. Re-date it when a run changes it.

The last live run, Actions run 40607512910 on 28 October, read the app's export (A4, legibility PR 47; `export.state: read`) and, for the first time, Legibility's buyer from Control Center's 1.13.0 directive (`icp.state: approved`; control-center PR 588). Its report is `degraded`, not `held`: `weekly_builders` was measured and travels both as an activity line and as an objective, because Control Center's objectives migration `20261112150000` is applied in production and the directive lists it. What the report still lacks, and what clears each:

| In the report | Why | What clears it |
|---|---|---|
| Hold `candidate_coverage_unknown` | The export owns no candidates: `composeSnapshot` leaves them empty with coverage false, and prepare holds every prospect while it is false | A candidate source: Phase 2's research step in the runner, or a `--snapshot` file prepared by hand (Wave 0) |
| Hold `opportunity_coverage_unknown` | The export owns no distribution inventory | An opportunity source (directories and partners, Phase 5) |
| Objectives `activated`, `returning`, `net` `missing` | The campaign clock in `config/policy.json` is not activated, so there is no campaign window to count in | Krish's ruling on the campaign clock (GET-GOING step 4) |
| Objective `conversations_held` `missing` (`calendar_read_missing`) | No read of Krish's calendar exists | Control Center's read-only calendar read (Phase 1 asks) |
| Hold `icp_not_current_approved` again, once the buyer is 30 days old | The buyer counts as current for 30 days after its `reviewed_at` (`icpCurrent` in `src/stages/prepare.mjs`). Buyer v2 was saved on 27 Oct, so it lapses about 26 Nov | Krish re-reviews the buyer in Growth > Buyers before then |

So the buyer alone does not let an export-fed run prepare invitations: that also needs a candidate source. When the export cannot be read, the run has no snapshot and sends the held report instead: `held`, nothing measured, holds `source_snapshot_missing` and `icp_not_current_approved` (until the buyer is served) beside the export's own code. Even with a snapshot, `activated`, `returning` and `net` stay `missing` until the campaign clock is activated; then they report builders with a first trusted read, mature seven-day returning builders and qualified Founding members.

### Reading the run summary

`operate` prints one JSON summary. Each field below appears only when its step ran.

| Field | Values | Meaning |
|---|---|---|
| `status`, `phase`, `error_code` | `succeeded`, `failed`, `unknown`; the step reached; a code or null | The attempt's terminal record. A business hold is not an error, so a held run still `succeeded` |
| `journal` | `closed`, `unclosed`, `not_started` | Whether the start and the terminal attempt records were written |
| `directive` | `directive_id`, `next_action` | Today's directive, or null when it could not be read |
| `icp` | `state`: `not_served`, `unread`, `refused`, `approved`, `missing`, `unavailable`; `reason`; `revision` | The buyer from the directive (`readIcp`). Never its words |
| `research` | `state`: `served`, `not_served`, `unavailable`; `kinds`; `per_day` | Whether the research desk is open to this engine. Recorded only |
| `export` | `state`: `read`, `held`, `absent`; `reason` | The app export. Absent when no `--snapshot` was given and neither export variable is set |
| `prior_outreach` | `state`: `read`, `partial`, `unavailable`, `unlinked`, `not_needed`; counts | The Mindmake records read (contracts/README.md) |
| `draft_press` | `state`: `served`, `not_served`, `unavailable`, `not_needed`; `actions` | Whether invitations went as version 2 email actions (contracts/README.md) |
| `report` | `status`, `mode`, `payload_sha256`, objectives with availability, proposal count, hold codes, `readback`, `replayed` | The envelope sent and its matched readback |
| `decisions` | `approved_exact`, `approved_changed`, `approved_elsewhere`, `declined`, `done` | Krish's decisions of the last seven days against this run's proposals |

### When a run fails

| Code | Where | What to do |
|---|---|---|
| `control_center_engine_token_missing` | before any request | The Actions secret is not set. Control Center issues the token (its issue-engine-token script) and Krish stores it as `CONTROL_CENTER_ENGINE_TOKEN` |
| `receiver_unauthorized` | any Control Center request | Control Center refused the bearer: it was rotated or revoked. Control Center reissues it and Krish updates the Actions secret. Never paste the value anywhere else |
| `receiver_contract_mismatch` | `GET capabilities` | The receiver does not take the report's version, or names another engine or product. Compare its capabilities with `SERVED` and `receiverTakes` in `src/guards/wire.mjs` (FAILURES F19) |
| `receiver_not_ready`, `receiver_rate_limited` | `GET capabilities`, `POST reports` | Control Center answered the capabilities with an error, or a 429. The next dispatch retries; nothing to repair here |
| `receiver_report_refused`, `receiver_identity_refused`, `receiver_report_too_large`, `receiver_rejected_report` | `POST reports` | Control Center refused the report (400, 403, 413 or another status). Validate the envelope against `docs/control-center/engine-report.schema.json` and the stand-in before the next run |
| `receiver_transport_uncertain` | any write | A response was lost, so the attempt is `unknown`. Run `deliver` with the same run id: it reads back before any second write (Recovery above) |
| `receiver_readback_mismatch`, `receiver_did_not_persist`, `receiver_ack_mismatch`, `receiver_report_conflict` | delivery | The stored report is not this one. Investigate with Control Center's owner; never delete the journal or change the run clock |
| `receiver_engine_inactive` | `POST reports` | Control Center has this engine switched off (409 `engine_inactive`). Krish switches it on in Growth > Engines |
| `outbox_attempt_budget_or_reconciliation_required` | `deliver` | Three delivery attempts are spent. Reconcile with Control Center's owner |
| `decisions_unavailable`, `decisions_invalid` | `GET decisions` | The report was delivered; only the decision tally failed. The next run reads decisions again |
| `attempt_rejected`, `attempt_conflict`, `attempt_unconfirmed` | `POST attempts` | The journal refused or could not confirm the attempt record. Read it back on Growth > Engines before running again |
| `dispatch_engine_mismatch`, `dispatch_directive_invalid` | before any request | The dispatch payload named another engine or a malformed directive id. Nothing ran |
| `synthetic_snapshot_refused`, `synthetic_export_refused` | capture | A synthetic input was aimed at the live origin (FAILURES F4). Nothing was sent |

The export never fails a run; it holds, and the attempt still `succeeded`:

| Hold | What to do |
|---|---|
| `export_unauthorized` | The app refused the bearer: the token `operate.yml` passes no longer matches the app's `GROWTH_EXPORT_TOKEN_SHA256`. Krish sets a dedicated `LEGIBILITY_EXPORT_TOKEN` and changes the app's hash to it in the same step (FAILURES F44) |
| `export_timeout`, `export_unavailable`, `export_transport_failed` | The app did not answer in 20 seconds, answered with an error, or could not be reached. The next dispatch retries |
| `export_contract_refused`, `export_shape_refused`, `export_version_unsupported`, `export_not_live` | The export broke the snapshot contract (its label is in the hold). The app's export must match contracts/README.md, "The app export" |
| `export_clock_ahead` | The export was stamped more than five minutes ahead of the runner |
| `export_window_too_large`, `export_window_refused` | The app refused the window the engine asked for (`exportWindow`) |
| `export_origin_not_approved`, `export_url_invalid`, `export_credential_missing` | `LEGIBILITY_EXPORT_URL` is off the pinned origin or not a plain route, or the token is empty. Nothing was called |
| `attribution_export_incomplete` | Only one of the two export variables is set |

### Mapping

| Producer output | Protocol envelope |
|---|---|
| Campaign target metrics | `objectives[]`: `activated` from first trusted reads, `returning` from seven-day returning, `net` from qualified enrolments, UTC, in the campaign window |
| The North Star number, `weekly_builders` | Always an activity line. Also an objective, after the three, when the directive lists it as registered (F43), its window Monday 00:00 UTC of the ISO week |
| `conversations_held` | An objective only when the directive lists it, `missing` with `calendar_read_missing` until a calendar read exists |
| The directive, legibility.io's readings | One activity line naming the directive; one on legibility.io's sessions when the directive carries `web_analytics`, counts only |
| Other scorecard lines | `activity[]` in plain words, with no names or private URLs |
| `pending_human` approval packet | Proposal with `wall: send`, `exact_payload` from `exact_text`, `payload_sha256` from `text_sha256`, `expires_at` kept; the id binds the prospect and channel. When the Draft press is served (1.12.0), an email invitation with a contact id and a Mindmake record travels instead as a version 2 email action, with `subject_ref` and `source_revision` (contracts/README.md) |
| `work_required` task, recommended constraint | Proposal with `wall: none` (activating the campaign clock is `wall: strategy`, a ruling for Krish) |
| `opportunities[]` | One activity line; the uncovered ones already arrive as work proposals |
| `holds[]` | `holds[]`, one per code, with the engine's own next step as the detail |
