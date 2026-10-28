# Legibility growth engine

An executable, evidence-led growth producer for [Legibility](https://legibility.io). It prepares qualified acquisition work, measures trusted product use, produces consent-safe benchmark aggregates and selects the next funnel constraint. It reports to Control Center through the one growth engine protocol that every growth engine shares: it sends version 1.0.0, or 1.12.0 when a report carries an email action for Control Center's Draft press (contracts/README.md).

The acquisition mechanism is **a useful product test that earns a builder's integration**, followed by partner distribution, rich named invitations, integration recipes and agent-native discovery. The engine optimises for trusted API/MCP reads and returning builders, then weekly production-agent dependency and settled mainnet-agent revenue. A signup count alone cannot establish that the product works.

The original [Founding 200 playbook](_corpus/legibility-growth-playbook.md) is preserved byte-for-byte, with a checked [SHA-256 manifest](_corpus/manifest.json). Its 225 gross / 200 qualified enrolments, 120 keys, 75 first trusted reads and 30 returns are test targets, not achieved results. The campaign clock is inactive until an actual activation is configured.

## Run it

Resuming beta acquisition? Read the [beta outreach and onboarding handoff](docs/BETA-HANDOFF.md) and [approved outreach template](docs/OUTREACH-TEMPLATE.md) first. The handoff separates completed private drafts from expired outreach, historical demo evidence and how a trial is granted (by hand, app item A8).

Node **24+**, npm, no runtime dependencies or paid services required.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run doctor
npm run check
npm run check:docs
npm test
npm run conveyor
npm run demo
```

The demonstration uses invented records only, labels every artifact `synthetic`, and writes to ignored `runtime/demo/`. Its final summary shows two qualified synthetic builders, one API/MCP activation, and testnet volume separated from revenue. No synthetic report can be delivered to the live receiver. `npm run check:docs` checks links, registers, the deny list and that no email address is committed; it runs in CI only, never in the daily job, so a docs defect cannot stop a run.

For an authenticated, complete private export from the source owner:

```sh
node src/cli.mjs run --snapshot runtime/input/snapshot.json --out runtime/live
node src/cli.mjs status --run-id RUN_ID --out runtime/live
```

A hand `run` reads nothing from Control Center, so its envelope is always protocol 1.0.0 ([OPERATIONS.md](docs/OPERATIONS.md), "Cycle"). To deliver a run's envelope to Control Center by hand, where the engine token already lives (no interactive session may hold the engine token):

```sh
node src/cli.mjs deliver --run-id CONTROL_CENTER_RUN_ID --out runtime/live
```

## The daily Control Center loop

Every morning at about 05:10 UTC Control Center wakes this repository with a `cc-growth-directive` dispatch. [`.github/workflows/operate.yml`](.github/workflows/operate.yml) then runs `node src/cli.mjs operate`, which does one run in the protocol's order:

1. Journals the attempt as `started`, before it reads any source.
2. Pulls today's directive: the next action, the objectives, Krish's recent decisions and, from protocol 1.13.0, Legibility's buyer.
3. Reads Control Center's capabilities: whether it serves the buyer, the Mindmake record, the Draft press and the research desk.
4. Reads the app's export (or takes a `--snapshot` file), measures it and prepares inside the walls, reading each candidate's Mindmake record from Control Center first.
5. Posts the report envelope with `Idempotency-Key` set to its `run_id`, then reads it back and compares the stored `payload_sha256`.
6. Reads Krish's decisions of the last seven days and counts which approvals match an exact payload digest from this run.
7. Closes the attempt as `succeeded`, `failed` with a lower_snake code, or `unknown` when a response was lost.

Every request, the environment it reads and what today's live report says are in [OPERATIONS.md](docs/OPERATIONS.md): "The Control Center loop", "Environment" and "What a dispatch measures today". A business hold is not an error, so a held run still closes as `succeeded`. Synthetic fixtures are refused on the live route.

The client speaks HTTPS to two pinned origins only (Control Center and the app's export), follows no redirects, waits at most 20 seconds per request and reads back before any second write. Credentials are read at run time and never printed or written; without `CONTROL_CENTER_ENGINE_TOKEN` the job says so and exits non-zero. There is no email sender, publisher or purchase executor in this repository. An approval only means Krish said yes to exactly that payload: for an invitation, Control Center's Draft press then places his approved words as a draft in his own Gmail, and he sends it himself.

## What is executable

| Responsibility | Observable result |
|---|---|
| Validate and reconcile | Typed, bounded, dated input; exact duplicate IDs deduplicated; conflicting records rejected |
| Measure activation | Verified and qualified people kept distinct; internal accounts excluded; null, below-gate and testbench-only reads cannot prove API activation |
| Measure dependency | Mature seven-day return cohort, trailing-week trusted reads, production-agent usage, mainnet versus testnet accounting |
| Prepare growth work | Six candidate pools, 30/20/20/20/10 scoring, evidence freshness, ICP and suppression checks; one shared maximum of five private tasks or approval items |
| Protect approval | Exact supplied wording, source/revision hashes, 48-hour expiry and one follow-up limit; unsafe copy becomes a work task |
| Reuse product evidence | Consent-aware benchmark with sample sizes, method/failure buckets and separate calibration strata |
| Optimise | Minimum-sample funnel tripwires, source ranking by activation before traffic, one recommended constraint |
| Report reliably | Protocol 1.0.0 envelope (1.12.0, with a version 2 email action for the Draft press, only when Control Center serves it) with a canonical digest, private SQLite transport spool, three total delivery attempts across restarts, independent readback and a journaled attempt per run |

This producer measures source-owned data: the app's export supplies accounts, reads, events and settlements, and everything else (candidates, opportunities, partners, feedback, billing) arrives only in a `--snapshot` file until Phase 2 builds a candidate source. It does not pretend to discover prospects, verify emails or instrument the production app from a fixture. The app work it depends on (A1 to A8) is in [handoff/APP-PHASE-1.md](docs/handoff/APP-PHASE-1.md), with its status.

## Ownership and next deployment

Control Center keeps the one private dashboard, source state and human approval queue, and records each accepted live report as a run under its growth owner, Maya ([Control Center brief](docs/CONTROL-CENTER-BRIEF.md)). SQLite here stores immutable delivery bytes and retry state only.

Start with [NOW.md](NOW.md) (where it stands and what waits on Krish) and [GET-GOING.md](docs/GET-GOING.md) (the build order). Then read the [engine architecture](docs/ENGINE-ARCHITECTURE.md), the [accepted brief](docs/BRIEF.md), the [operations guide](docs/OPERATIONS.md), the [failure register](docs/FAILURES.md), the [source register](docs/SOURCE-REGISTER.md), the [contract guide](contracts/README.md), the [copy doctrine](docs/COPY-DOCTRINE.md) for every draft, the [beta handoff](docs/BETA-HANDOFF.md), the [Control Center brief](docs/CONTROL-CENTER-BRIEF.md) with its [protocol](docs/control-center/ENGINE-PROTOCOL.md), and the superseded [handoff](docs/CONTROL-CENTER-HANDOFF.md), kept for history. The [release record](docs/RELEASE.md) separates local proof from live deployment and campaign results.
