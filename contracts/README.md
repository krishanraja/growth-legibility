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

## Additions within producer contract 1.0.0 (27 October 2026)

**`candidates[].contact.prior_mindmake`** (optional). Control Center's Mindmake record for the person, under Krish's ruling of 27 October 2026 that, to someone he already reached for Mindmake, Legibility is positioned as a partner product. Its one source is Control Center's prior-outreach reader, and the exporter (or a session preparing items by hand) copies the reader's answer unchanged. Until the reader exists there is no answer to copy, so every item holds as `mindmake_history_unknown`. This repository never derives it, and never matches a person by name, company or a guessed address.

When present it is a closed object of exactly five keys, with no names, addresses, message words or figures:

- `state`: `none`, `unknown`, `open`, `client`, `drafted`, `sent`, `replied` or `met`.
- `by`: null, `krish` (Krish's own Mindmake note or conversation) or `other` (a Mindmake note sent for him). Visibility notes (podcast pitches, guest invites, press, the visibility notes a colleague sends for him) are not reaching out for Mindmake (Ruling, Krish, 2026-10-27): someone touched only by those reads `none`.
- `state_at` and `last_touch_at`: null or a UTC instant at or before `captured_at`.
- `record_url`: null or an https link to the person's Control Center record, with no credentials, at most 2000 characters.

| state | by | state_at | last_touch_at | record_url |
|---|---|---|---|---|
| unknown | null | null | null | null |
| none | null | null | null | https |
| open, client | null | null or UTC | null or UTC | https |
| drafted | null | UTC | UTC, at or after state_at | https |
| sent, replied | krish or other | UTC | UTC, at or after state_at | https |
| met | krish | UTC | UTC, at or after state_at | https |

**Unknown is not none.** An absent field means unknown and holds the candidate (`mindmake_history_unknown`), and so does `state: "unknown"`. Null is refused at the wire, so a failed join can never read as none. `none` means Control Center read every source completely and found no Mindmake touch for that contact.

The wire refuses a broken record before the capture digest, and the whole snapshot with it: `invalid_contract:unknown_fields_candidate_prior_mindmake` (null, an array, a non-object or an extra key), `invalid_contract:candidate_prior_mindmake_shape` (a missing key, a combination outside the table, a date after capture, or a last touch before `state_at`), `invalid_contract:candidate_prior_mindmake_state` and `invalid_contract:candidate_prior_mindmake_record`. Prepare re-checks the record, holds `open` (`mindmake_thread_open`), `client` (`mindmake_client`) and a touch under 14 days old (`mindmake_touch_too_recent`), and binds all five keys into each approval packet.

`contact.last_sent_at` and `followups` count this engine's own Legibility sends only. A Mindmake touch never fills them, so a first Legibility note to someone reached for Mindmake stays a direct invitation and never uses up the one follow-up.

**Release order.** This validator ships before any exporter that writes the field: a consumer still vendoring the earlier validator refuses such a snapshot as `unknown_fields_candidate_contact`. No live exporter exists yet. `VERSION` stays 1.0.0, because the same constant stamps the protocol envelope, which does not change. When the planned split of the protocol version from the producer version lands (docs/ENGINE-ARCHITECTURE.md, section 1), the producer contract becomes 1.1.0 and names this field. manifest.json was refrozen for `src/guards/wire.mjs`, `src/stages/prepare.mjs`, the fixture (whose candidate gained a `none` record, cited in its draft sources) and both examples. For that candidate the send proposal's exact words and `payload_sha256` are unchanged; its `why` says what Control Center records about Mindmake, and its evidence leads with the record link.

## The app export (Phase 1B, 27 October 2026)

`src/lib/export-client.mjs` reads the app's row-level export (docs/handoff/APP-PHASE-1.md, A4) and composes the snapshot above from it, exactly as the brief's acceptance test does: the app-owned sections (`accounts`, `reads`, `events`, `settlements`) pass through unchanged, every other section is empty with its coverage false, and `icp.status` is `missing`. The composed snapshot then runs through `validateSnapshot` and the same capture and measure as any other, so every guard here still applies. The export envelope is closed too: exactly `export_version` (`1.0.0`), `mode`, `captured_at`, `app_revision`, `window`, `coverage` (`accounts`, `reads`, `events`, `settlements`), `reconciliation` (`reads_metered`, `reads_exported`) and the four row sections. When the two reconciliation counts differ, read coverage is false whatever the app's flag says.

The client takes `LEGIBILITY_EXPORT_URL` (an Actions variable: a route on `https://legibility.io`, the only origin it calls) and `LEGIBILITY_EXPORT_TOKEN` (an Actions secret, never printed). It sends a bearer GET with `start` and `end` as UTC instants, refuses redirects, stops at 20 seconds and 20 MB, and takes JSON only. Only a `live` export is read from the app's origin. The attribution fields (`fields=attribution`) are not accepted yet: the validator still refuses them, and the client never asks for them.

The scorecard also carries `weekly_builders`, the engine's North Star number: builders with at least one trusted read in the ISO week to date, internal accounts excluded, counted per account until the export carries key ids. It travels in the protocol envelope as an activity line; `objectives[]` keeps `activated`, `returning` and `net`. manifest.json was refrozen for `src/stages/measure.mjs` and both examples, which gained that metric and line; the fixture and every other pinned file are unchanged.
