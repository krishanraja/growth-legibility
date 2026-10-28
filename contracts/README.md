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

What travels to Control Center is the protocol 1.0.0 envelope (or 1.12.0 when it serves the Draft press, below) (docs/control-center/engine-report.schema.json), built by engineReport() in src/orchestrator.mjs and checked by validateEngineReport() in src/guards/wire.mjs. contracts/example-engine-report.json is the frozen envelope for the synthetic fixture; npm run check rebuilds both examples and fails on drift. The private report above never leaves the runtime spool. Existing growth/packs and attribution routes are incompatible.

## Additions within producer contract 1.0.0 (27 October 2026)

**`candidates[].contact.prior_mindmake`** (optional). Control Center's Mindmake record for the person, under Krish's ruling of 27 October 2026 that, to someone he already reached for Mindmake, Legibility is positioned as a partner product. Its one source is Control Center's prior-outreach reader, and the exporter (or a session preparing items by hand) copies the reader's answer unchanged. The reader exists (control-center PR 581, protocol 1.11.0), and `operate` copies its answer itself (below); an item with no record holds as `mindmake_history_unknown`. This repository never derives it, and never matches a person by name, company or a guessed address.

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

**Release order.** This validator ships before any exporter that writes the field: a consumer still vendoring the earlier validator refuses such a snapshot as `unknown_fields_candidate_contact`. No exporter writes the field: the app's export owns no candidates, and `operate` fills it from Control Center's reader. `VERSION` stays 1.0.0, because the same constant stamps the protocol envelope, which does not change. When the planned split of the protocol version from the producer version lands (docs/ENGINE-ARCHITECTURE.md, section 1), the producer contract becomes 1.1.0 and names this field. manifest.json was refrozen for `src/guards/wire.mjs`, `src/stages/prepare.mjs`, the fixture (whose candidate gained a `none` record, cited in its draft sources) and both examples. For that candidate the send proposal's exact words and `payload_sha256` are unchanged; its `why` says what Control Center records about Mindmake, and its evidence leads with the record link.

## The app export (Phase 1B, 27 October 2026)

`src/lib/export-client.mjs` reads the app's row-level export (docs/handoff/APP-PHASE-1.md, A4) and composes the snapshot above from it, exactly as the brief's acceptance test does: the app-owned sections (`accounts`, `reads`, `events`, `settlements`) pass through unchanged, every other section is empty with its coverage false, and `icp.status` is `missing`. The composed snapshot then runs through `validateSnapshot` and the same capture and measure as any other, so every guard here still applies. The export envelope is closed too: exactly `export_version` (`1.0.0`), `mode`, `captured_at`, `app_revision`, `window`, `coverage` (`accounts`, `reads`, `events`, `settlements`), `reconciliation` (`reads_metered`, `reads_exported`) and the four row sections. When the two reconciliation counts differ, read coverage is false whatever the app's flag says.

The client takes `LEGIBILITY_EXPORT_URL` (an Actions variable: a route on `https://legibility.io`, the only origin it calls) and `LEGIBILITY_EXPORT_TOKEN` (an Actions secret, never printed). It sends a bearer GET with `start` and `end` as UTC instants, refuses redirects, stops at 20 seconds and 20 MB, and takes JSON only. Only a `live` export is read from the app's origin. The attribution fields (`fields=attribution`) are not accepted yet: the validator still refuses them, and the client never asks for them.

The scorecard also carries `weekly_builders`, the engine's North Star number: builders with at least one trusted read in the ISO week to date, internal accounts excluded, counted per account until the export carries key ids. It always travels in the protocol envelope as an activity line, and also as an objective when the directive registers it (protocol 1.13.0, below; FAILURES F43). manifest.json was refrozen for `src/stages/measure.mjs` and both examples, which gained that metric and line; the fixture and every other pinned file are unchanged.

## The Mindmake record, read by the runner (protocol 1.11.0, 27 October 2026)

**`candidates[].contact.contact_id`** (optional). The person's Control Center contact id: a lowercase uuid, never a name, an address, an uppercase id or null (`invalid_contract:candidate_contact_id`). It is the only key the record is read by.

`operate` reads each record from Control Center before it builds the report (`src/lib/prior-outreach.mjs`): `GET /api/growth/engines/legibility/prior-outreach?contacts=<ids>` on the engine's own bearer, only when `capabilities.features.prior_outreach` is true, in batches of at most 50 distinct ids (Control Center's `MAX_CONTACTS`) and at most 4 batches a run. Each record is copied into `contact.prior_mindmake` unchanged. In `operate` the reader is the only writer of that field: a record already in the snapshot is dropped first. The field stays absent, which prepare holds as `mindmake_history_unknown`, when:

- the candidate has no `contact_id`;
- Control Center does not serve the route, or a read fails (any status, a body that is not `{ ok: true, schema_version: 1.x, prior_outreach: {} }`, a rate limit);
- an id is missing from the answer, or past the 4-batch cap;
- the record breaks the rules in the table above (`validateMindmakeRecord`), is dated after `captured_at`, or links a record other than this person's (`record_url` must be `https://controlcenter.krishraja.com/#/people?person=<contact_id>`, or null when unknown).

A refused record leaves only that person unknown; it never refuses the snapshot. Nothing writes `none` on a failure. The run's printed summary names the outcome in counts and codes only (`prior_outreach`: `read`, `partial`, `unavailable`, `unlinked` or `not_needed`). `run` and `check:invitation` do not read Control Center: they take the record their input carries.

The approval packet now binds `contact.contact_id` beside the record. The fixture's candidate gained a synthetic `contact_id`, and its record link and draft source became the Control Center person link for that id. manifest.json was refrozen for `src/guards/wire.mjs`, `src/stages/prepare.mjs`, the fixture and both examples; the send proposal's exact words and `payload_sha256` are unchanged, and its evidence leads with the new record link.

**What feeds it.** No producer fills `contact_id` yet: the app export owns no candidates (they are empty with coverage false), so today a candidate reaches the runner only in a `--snapshot` file. The id comes from Control Center (a contact Krish already has, or one its research desk's `person_route` files), carried by the runner's research step in Phase 2.

## The Draft press: a version 2 email action (protocol 1.12.0, 27 October 2026)

Ruling (Krish, 2026-10-27): "Legibility drafts land in Krish's mindmake.co mailbox, and the press re-reads the Mindmake record first." Control Center's Clear drafts an approved invitation into his own Gmail only when it arrives as a version 2 email action (control-center PR 585, merged as `23f733b` and deployed in production; docs/control-center/ENGINE-PROTOCOL.md, "Legibility drafts in his own box"). Plain words stay a plain approval, and he copies them.

**When.** `operate` asks the capabilities only when an invitation could be one, and sends 1.12.0 only when they say `features.draft_press: true`, serve 1.12.0 or later (`schema_version`) and take a 1.12.0 report (`schema_versions`). The feature absent or false, an older version, a failed read or an unreadable template all send the 1.0.0 envelope, byte for byte the one sent before. Delivery checks again that the receiver takes the report's own version, and refuses `receiver_contract_mismatch` before any write. `run` and `check:invitation` never ask Control Center, so they stay 1.0.0. The run's printed summary names the outcome in counts and codes only (`draft_press`: `served`, `not_served`, `unavailable` or `not_needed`).

**The action.** Each prepared invitation (`pending_human`, before his Clear) whose candidate carries both `contact.contact_id` and `contact.prior_mindmake`, on an email channel (`email` or `manual-email`), whose approved words open with a `Subject:` line, travels as its `exact_payload`, the canonical JSON of exactly:

- `version: 2`, `channel: "email"`, `form: null`;
- `recipient_contact_id`: the candidate's `contact.contact_id`;
- `subject` and `body`: prepare's approved and linted words, split at the first line (`Subject:` and the rest), with only edge whitespace dropped, which Control Center trims anyway;
- `mailbox: "krish"`;
- `prior_mindmake`: the candidate's record, all five keys, copied unchanged from Control Center's reader.

The proposal keeps its `proposal_id` and adds `subject_ref` (`contact:<id>`, the same person) and `source_revision` (`[{ repo: "krishanraja/growth-legibility", path: "docs/OUTREACH-TEMPLATE.md", sha }]`, the file's git blob SHA computed from the checkout with LF line endings, as GitHub's contents API gives it on `main`, which is what Control Center reads again before the press). Its `channel` is `email`, and its `why` says Control Center drafts the words into his own Gmail. `payload_sha256` is the SHA-256 of the exact action, so his approval binds the recipient, the words, the box and the record; the same words and record give the same digest on every run, whatever order the record's keys arrive in. Every other proposal is unchanged.

Anything that cannot be one stays plain words: no contact id or record (those are held as `mindmake_history_unknown` before this point), a channel that is not email, no subject line, or a record link that is not the person's own. A report carries 1.12.0 only when at least one action does.

**The wire.** `validateActionV2` (src/guards/wire.mjs) checks each action before the report is sealed or posted: the eight keys and no other, a lowercase contact id, a one-line subject of at most 200 characters and words of at most 7,000, both without edge whitespace, `mailbox: "krish"`, and a record that passes `validateMindmakeRecord`, is `none`, `drafted`, `sent`, `replied` or `met`, and links the recipient's own record. `validateEngineEnvelope` takes 1.12.0 beside 1.0.0, and at 1.12.0 only: an action only on a prepared send whose `channel` is `email`, `subject_ref` naming its recipient, 1 to 8 `source_revision` entries with '/' paths and 40-character SHAs, and a digest equal to the action's. `subject_ref` and `source_revision` on anything else, a version 2 action at 1.0.0, and a 1.12.0 report with no action are refused.

manifest.json was refrozen for `src/guards/wire.mjs` only. Both frozen examples were rebuilt and are unchanged: they are built with no Control Center, so they are the 1.0.0 envelope. docs/control-center/engine-report.schema.json was then Control Center's schema at `efad466` (PR 585's head), since refreshed with the 1.13.0 copy below, and the stand-in (tests/standin.mjs) reads a report and presses an action as Control Center does there.

## What Control Center's directive carries (protocol 1.13.0, 27 October 2026)

On 27 October every live run held `icp_not_current_approved` though Krish had saved Legibility's buyer in Control Center's `product_icp` that day: nothing carried it here. Control Center's 1.13.0 (control-center PR 588, merged as `20b8b51` and deployed 28 Oct; its protocol commit is `20b8b51`) puts it in this engine's directive, and the run of 28 October read it as `approved` and cleared the hold (docs/OPERATIONS.md, "What a dispatch measures today"). The snapshot contract does not change: `snapshot.icp` keeps its six keys and its rules, which `validateIcp` (src/guards/wire.mjs) now applies to the snapshot and to the directive alike.

**The buyer.** When the capabilities say `features.icp: true`, `operate` reads the directive's `icp` (`readIcp`, src/lib/cc-signals.mjs): exactly `product_slug`, `source`, `buyer_definition`, `status`, `revision` and `reviewed_at`, Legibility's own row from `control-center:product_icp`, reviewed no later than the run clock, `approved` or `missing`. Anything else is refused and treated as no buyer. A served buyer replaces the snapshot's, since Control Center is the one source; one reviewed after the snapshot's capture cannot be bound to it and makes the snapshot's buyer `missing`, which holds (`applyIcp`). With no snapshot, a current approved buyer (`icpCurrent` in src/stages/prepare.mjs, prepare's own rule: approved, Legibility's own, from `product_icp`, with a revision and a review time not after the run; an approved buyer stays current until Krish changes it, Ruling, Krish, 2026-10-28) clears `icp_not_current_approved` from the held report, which then says the buyer arrived and its revision. Absent from the directive means Control Center could not read it today: unknown, which holds exactly as before. Only the state and the revision reach the printed summary, never the words.

**The objectives.** When the directive's `objectives` list `weekly_builders` and `conversations_held` (Control Center migration `20261112150000`, applied to production on 27 October, so the live directive already lists both), the envelope reports them as objectives after `activated`, `returning` and `net`: `weekly_builders` from measure, its window from Monday 00:00 UTC of the ISO week (Control Center's North Star reader checks it), and `conversations_held` null with `calendar_read_missing` until a calendar read exists. Unlisted, the three objectives are reported exactly as before. `weekly_builders` stays an activity line either way.

**The site.** When the directive carries `web_analytics` for legibility.io, one activity line says its sessions over the last 7 days on file against the 7 before, each with how many days had a reading, and the site check in its own words (`siteActivity`). Unknown is said, never zero; the measurement id is never printed.

**The research desk.** Recorded in the run summary as available, with its kinds and daily caps (`researchAvailability`); no research request is made until Phase 2 builds the research step.

manifest.json was refrozen for `src/guards/wire.mjs` (`validateIcp`) and `src/stages/prepare.mjs` (`icpCurrent`, the same rule exported). Both frozen examples were rebuilt and are unchanged: they are built with no directive. docs/control-center/ENGINE-PROTOCOL.md and engine-report.schema.json were copied again from Control Center at 1.13.0.

