# Control Center brief: growth-legibility

> **Status, 2026-10-19: adopted.** The engine speaks protocol 1.0.0 through `src/transport.mjs` and `src/operate.mjs`, and `.github/workflows/operate.yml` answers the `cc-growth-directive` dispatch. See `docs/OPERATIONS.md`, "The Control Center loop".
>
> **Status, 2026-10-27: live, not only tested against the stand-in.** The first live run on 2026-10-19 succeeded: it journaled its attempt, read the directive, sent a report, read it back by digest and read Krish's decisions. The daily dispatch has run every day since, apart from the 33.5-hour gap on 20 and 21 October that 2b65ea6 fixed ([history log](history/LOG.md)). Every report so far is `held`, with the objectives missing. The engine's architecture and build plan is [ENGINE-ARCHITECTURE.md](ENGINE-ARCHITECTURE.md).

Written 2026-10-18 by Control Center. This brief **supersedes `docs/CONTROL-CENTER-HANDOFF.md`**. Most of your proposal is now the protocol for every engine: your paths, your envelope, your digest rule and your idempotency. Krish ruled that every growth engine conforms to one protocol (ADR-038 in Control Center).

## What Control Center now does for you

- **Built your receiver, generalised**, under `/api/growth/engines/legibility/`.
- **Writes one `workflow_runs` row** per accepted live report, with `agent_id: maya` and the metadata you asked for. A business hold is not an error.
- **Pushes you one next action every day, chosen by rule.**
- **Puts your `approval_required` packets on Krish's one list**, and returns his decision bound to the text hash.
- **Isolates synthetic reports on the server.**

## Your registry row

| | |
|---|---|
| Slug in the path | `legibility` |
| `engine_id` | `growth-legibility` |
| `product_slug` | `legibility` |
| Aim | The Founding 200 targets are met for real: 75 builders with a first trusted read and 30 returning, each earned by a useful product test or a rich named invitation, never a list. By 2026-12-31 |
| Objectives | `activated`: 75; `returning`: 30; `net`: 200 (campaign window) |
| Cadence | daily |
| State | Switched on 2026-10-18, with dispatch on. Your bearer arrives in this repository's secrets as `CONTROL_CENTER_ENGINE_TOKEN`, with `CONTROL_CENTER_URL` as a variable. Until then, build against `mode: synthetic` |

## The protocol, in short

The full spec is `docs/control-center/ENGINE-PROTOCOL.md`, with the report and directive schemas and a worked example beside it. In short:

**Base URL and auth.**
- Base: `CONTROL_CENTER_URL`, which is `https://controlcenter.krishraja.com`.
- Bearer: `Authorization: Bearer $CONTROL_CENTER_ENGINE_TOKEN`. This is a `gen1_` token issued for this engine alone. Control Center keeps only its SHA-256, and it opens this engine's routes and no others.
- Transport: HTTPS only. Follow no redirects, use bounded timeouts, and read back before retrying any write.

**Every run, in this order:**
1. `POST {base}/api/growth/engines/legibility/attempts` with `status: started`, before reading any source.
2. `GET {base}/api/growth/engines/legibility/directive` returns today's `next_action`, your objectives with their targets and latest values, his decisions of the last seven days, and the walls.
3. Do the work, inside the walls. The rule, word for word: "Nothing sends, posts, spends, deletes or changes a permission without a decision from Krish whose payload_sha256 matches what you are about to do."
4. `POST {base}/api/growth/engines/legibility/reports` with header `Idempotency-Key: {run_id}`. The body is the report envelope:
   - `schema_version: "1.0.0"`, `engine_id`, `product_slug`, `run_id`, `mode`, `observed_at`, `source`, `status`
   - `objectives[]`, `activity[]`, `proposals[]`, `events[]`, `holds[]`
   - `payload_sha256`: the SHA-256 of the canonical JSON without that field, with keys sorted at every depth and no whitespace

   An unknown field is refused, never dropped. Then `GET .../reports/{run_id}` and compare the digest.
5. `POST .../attempts` again with the terminal state (`succeeded`, `failed` with a lower_snake `error_code`, or `unknown`) and `finished_at`. A terminal record never changes.
6. `GET {base}/api/growth/engines/legibility/decisions?since={last run}` returns his yes and no, each with the `payload_sha256` it was made on. Act on a yes only when that digest equals the payload you are about to use. A changed payload is a new ask, and it goes back to him by itself when you report it.

**How proposals and readings are judged.**
- A proposal behind a wall (`spend` with its `amount_usd`, `send` or `post` with its `exact_payload`, or `strategy`) goes on Krish's one list on Home, where Clear approves it, Purge declines it and Bump defers it a day.
- A proposal inside the walls is yours to do. Control Center may pick it as your next push.
- Unknown is `value: null` with a `reason`, never zero. A measured zero is `0`.
- `mode: synthetic` is stored and read back but never touches his numbers or his list. Use it to prove your client before Krish switches you on. A live report is refused (409 `engine_inactive`) until he does.

**The wake-up.** Control Center wakes you once a day around 06:10 London with `repository_dispatch` of type `cc-growth-directive`, whose `client_payload` is `{ directive_id, engine_id }` and nothing else. Add that trigger to your workflow. If you do not run on GitHub Actions, pull the directive at the start of your own run instead; it is the same directive.

## How your proposal maps

| Your proposal | In the protocol |
|---|---|
| `GET …/capabilities` exact body | Now carries `activation` and `features` as well. Compare `schema_version`, `engine_id` and `product_slug` only |
| `schema_version: "1.0.0"`, `payload_sha256` canonical rule, `Idempotency-Key = run_id`, replay and 409 | Unchanged |
| `LEGIBILITY_CC_TOKEN` | Store your token as `CONTROL_CENTER_ENGINE_TOKEN` (any name works on your side). It is a `gen1_` token |
| `scorecard` | Flattened. Each target you report goes in `objectives[]` with `availability`. The rest of the scorecard goes in `activity[]`, or is left out |
| `actions[]` (approval packets: `exact_text`, `text_sha256`, `expires_at` +48h) | Proposals: `wall: send`, `exact_payload` for `exact_text`, `payload_sha256` for `text_sha256`, `expires_at` unchanged |
| `opportunities[]` | Proposals with `wall: none`, or `activity[]` |
| `holds[]` | Unchanged |
| `mode: synthetic` | Unchanged, and enforced on the server |
| Readback `{accepted, run_id, payload_sha256}` | Unchanged, and it also returns the report |

## Still owed by Control Center (named, not built)

- The attribution allowlist for `app: legibility`.
- A narrow `product_icp` read path for your snapshot exporter.

Until they exist, report the affected measures as missing with the reason.

## Acceptance

Your step 3 receiver tests run against the real routes: wrong product or engine, bad digest, header and body key mismatch, replay, conflict and synthetic isolation. They are also in Control Center's own `tests/api/growthEngines.test.ts`.
