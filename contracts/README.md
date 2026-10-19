# Producer contract 1.0.0

The executable boundary is src/guards/wire.mjs. fixtures/snapshot.json is a complete synthetic input.
The executable validator and frozen synthetic example describe the cross-repository wire shape; both repositories must use this release's version and fixtures. manifest.json pins the artifacts by SHA-256. The consumer must import or vendor this exact validator, rather than silently defining a different shape.
Missing coverage is not an empty population. Complete=true asserts pagination, window and source reconciliation by the authenticated exporter.
Never populate a snapshot from browser analytics alone. Product reads must come from server metering; verification and keys from auth; billing from settled provider records; suppression from the private people owner.
Account IDs are opaque. canonical_id is a source-owned alias, never a guessed match. Production agent flags require reviewed deployment evidence retained by the source owner.
Approved ICP objects bind product_slug=legibility and source=control-center:product_icp, with a nonempty buyer_definition, revision and reviewed_at. These are provenance assertions supplied by the authenticated source exporter; a local file alone is not proof of canonical approval.
All timestamps are explicit UTC (Z) with real calendar instants; windows are half-open [start,end). Returns have a separate mature seven-day cohort. Campaign activation is explicit, never inferred from this repository's creation date. Campaign cohorts are bounded to exactly 30 days, while weekly usage remains a trailing-seven-day measure.

Reports are private. Only publicSummary() is designed for presentation outside the private consumer; aggregate publication still needs approval.
payload_sha256 hashes canonical sorted JSON excluding that field. run_id binds normalized source, policy, clock and corpus revision.
Idempotent delivery uses the same immutable report. A changed clock produces a new observation/run, never a second copy of the same frozen report.

What travels to Control Center is the protocol 1.0.0 envelope (docs/control-center/engine-report.schema.json), built by engineReport() in src/orchestrator.mjs and checked by validateEngineReport() in src/guards/wire.mjs. contracts/example-engine-report.json is the frozen envelope for the synthetic fixture; npm run check rebuilds both examples and fails on drift. The private report above never leaves the runtime spool. Existing growth/packs and attribution routes are incompatible.
