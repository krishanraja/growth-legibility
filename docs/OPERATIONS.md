# Operate the producer

## Install and baseline

Use Node 24+ and npm ci. Run doctor, check, test, conveyor and demo. The demo is offline and synthetic. Never copy its counts into live growth reporting. No populated credential file, private snapshot or runtime report belongs in Git or CI artifacts.

The canonical private source owner supplies a complete snapshot matching fixtures/snapshot.json and contracts/README.md. mode=live is an assertion by that authenticated exporter, not a way to upgrade synthetic evidence. The consumer must independently establish source ownership and coverage before accepting it.

Coverage flags must reflect full pagination and reconciliation. Missing sources are false, even when their arrays are empty. A complete empty source measures zero; unavailable data measures null. Usage events come from server metering rather than client first_trusted_read assertions. Every actual call must carry the product-present flag, confidence and calibration. Account canonical_id is explicit identity evidence from the owner, never a name/email guess by this engine.

## Cycle

1. Export source-owned accounts, server reads, events, canonical ICP, private candidate evidence, contact/suppression state, partner distribution, feedback, settled payments and actual source coverage. Protect the export under runtime/input/.
2. Run `node src/cli.mjs run --snapshot runtime/input/snapshot.json --out runtime/live`. Inspect the emitted mode, status, unknown reasons, recommended constraint and pending actions in the private report.
3. Source gaps, overdue reviews, partial windows, stale live snapshots and detected paid media hold actionable work. Repair the owning source rather than editing the output to look successful.
4. After the Control Center receiver is implemented and approved, inject its narrow credential through the managed runtime. Deliver the exact immutable run ID. Do not point the engine at growth/packs, dashboard APIs or a generic table-write endpoint.
5. Confirm matching persisted digest, private growth report, owner/job run status and correct product measures in the dashboard. The engine's delivered status proves only the digest readback protocol; dashboard projection must also pass the consumer acceptance checklist.

## Approval and suppression

Only exact supplied, checked drafts become pending_human packets. The engine can return specific research, source-lineage or draft-production work without fabricating prose. Each pending packet binds candidate, channel, exact text hash and source revision. It expires after 48 hours. The private consumer must re-read the current ICP, source evidence, global suppression and contact history immediately before human review and execution.

A work_required task is not an outbound approval. An old approval flag in input grants no authority. No endpoint in this repository sends, publishes, spends or approves. The human acts from the exact reviewed destination, using their existing approved tools. The source owner records observed delivery and reply outcomes for the next run.

## Recovery

Use `node src/cli.mjs status --run-id RUN_ID --out runtime/live` to see pending, uncertain or delivered and the durable attempt count. Re-run deliver with the same run ID to reconcile. It always GETs the stored digest before any new POST. If an earlier POST persisted but its response was lost, reconciliation acknowledges the existing write and consumes no further POST.

An absent authoritative readback allows a bounded idempotent retry once any existing 120-second reservation has expired. An unavailable or mismatched readback does not. Three attempts survive process restarts; repeated invocations never renew that budget. Investigate exhausted delivery with the Control Center owner rather than deleting the journal or changing the run clock to bypass it. Concurrency uses atomic local reservations fenced by their durable attempt generation, plus server idempotency. A stale resumed process cannot clear a newer reservation. The consumer must enforce uniqueness on run_id and reject digest conflicts transactionally.

Restore an older producer through normal Git review if code fails. Reproduce private reports from their original source, policy, observed_at and corpus digest. Retain source revisions with the source owner. Preserve uncertain outbox rows until authoritative reconciliation. Never delete business records as a recovery technique.

## Operating cadence and useful work

No schedule is enabled by this build. After activation, the existing Control Center operator can schedule one source export and producer cycle daily and a weekly review. The corpus's five London-time moments are suggested work stages, not five required full runs. Keep one active material acquisition experiment, maximum five new approval/work items per run, one human-reviewed follow-up and zero paid media.

Review activation and mature return by source before reach. Work through the minimum-sample tripwires; do not rewrite strategy from tiny denominators. Review honest coverage and high failure methods before adding distribution. Only consented aggregate benchmark evidence can become a public draft, and publication remains a separate approved action.

A production agent flag must be supported by actual deployment evidence retained in the source owner. Sepolia amounts are testnet volume, never revenue. Convert settled amounts to USD using source-owned dated rates before export, remove failed settlement, and reconcile signup revenue including refunds. The engine does not call Stripe or a wallet.
