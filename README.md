# Legibility growth engine

An executable, evidence-led growth producer for [Legibility](https://legibility.io). It prepares qualified acquisition work, measures trusted product use, produces consent-safe benchmark aggregates and selects the next funnel constraint. It reports to Control Center through the one growth engine protocol (version 1.0.0) that every growth engine shares.

The acquisition mechanism is **a useful product test that earns a builder's integration**, followed by partner distribution, rich named invitations, integration recipes and agent-native discovery. The engine optimises for trusted API/MCP reads and returning builders, then weekly production-agent dependency and settled mainnet-agent revenue. A signup count alone cannot establish that the product works.

The original [Founding 200 playbook](_corpus/legibility-growth-playbook.md) is preserved byte-for-byte, with a checked [SHA-256 manifest](_corpus/manifest.json). Its 225 gross / 200 qualified enrolments, 120 keys, 75 first trusted reads and 30 returns are test targets, not achieved results. The campaign clock is inactive until an actual activation is configured.

## Run it

Node **24+**, npm, no runtime dependencies or paid services required.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run doctor
npm run check
npm test
npm run conveyor
npm run demo
```

The demonstration uses invented records only, labels every artifact `synthetic`, and writes to ignored `runtime/demo/`. Its final summary shows two qualified synthetic builders, one API/MCP activation, and testnet volume separated from revenue. No synthetic report can be delivered to the live receiver.

For an authenticated, complete private export from the source owner:

```sh
node src/cli.mjs run --snapshot runtime/input/snapshot.json --out runtime/live
node src/cli.mjs status --run-id RUN_ID --out runtime/live
```

To deliver a run's envelope to Control Center by hand:

```sh
node src/cli.mjs deliver --run-id CONTROL_CENTER_RUN_ID --out runtime/live
```

## The daily Control Center loop

Every morning at about 05:10 UTC Control Center wakes this repository with a `cc-growth-directive` dispatch. [`.github/workflows/operate.yml`](.github/workflows/operate.yml) then runs `node src/cli.mjs operate`, which does one run in the protocol's order:

1. Journals the attempt as `started`, before it reads any source.
2. Pulls today's directive: the next action, the objectives and Krish's recent decisions.
3. Does the engine's own work inside the walls. With a source snapshot it measures and prepares; without one it measures nothing and holds.
4. Posts the report envelope with `Idempotency-Key` set to its `run_id`, then reads it back and compares the stored `payload_sha256`.
5. Reads Krish's decisions of the last seven days and counts which approvals match an exact payload digest from this run.
6. Closes the attempt as `succeeded`, `failed` with a lower_snake code, or `unknown` when a response was lost.

A clean GitHub runner has neither the app's source snapshot nor the canonical ICP, so today a dispatch run reports `held`: the three objectives (`activated`, `returning`, `net`) are `missing` with the reason, and the holds name `source_snapshot_missing` and `icp_not_current_approved`. A business hold is not an error, so the attempt still closes as `succeeded`. Synthetic fixtures are refused on the live route.

The bearer is `CONTROL_CENTER_ENGINE_TOKEN` (an Actions secret) and the target is `CONTROL_CENTER_URL` (an Actions variable, `https://controlcenter.krishraja.com`). Both are read at run time and never printed or written. The client speaks HTTPS to that one origin, follows no redirects, waits at most 20 seconds per request and reads back before any second write. Without the token the job says so and exits non-zero. There is no email sender, publisher or purchase executor in this repository: an approval only means Krish said yes to exactly that payload, and he acts himself.

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
| Report reliably | Protocol 1.0.0 envelope with a canonical digest, private SQLite transport spool, three total delivery attempts across restarts, independent readback and a journaled attempt per run |

This producer accepts source-owned snapshots. It does not pretend to discover prospects, verify emails or instrument the production app from a fixture. Current canonical ICP state, private source access, `/builders-beta`, report saving and referral flow require their owning app/runtime changes before a live campaign can operate. Those are concrete activation prerequisites in the handoff.

## Ownership and next deployment

Control Center keeps the one private dashboard, source state and human approval queue. The engine is intended as a job under its existing growth owner, Maya, after live roster verification. SQLite here stores immutable delivery bytes and retry state only.

Read the [accepted brief](docs/BRIEF.md), [operations guide](docs/OPERATIONS.md), [source register](docs/SOURCE-REGISTER.md), [contract guide](contracts/README.md) the [Control Center brief](docs/CONTROL-CENTER-BRIEF.md) with its [protocol](docs/control-center/ENGINE-PROTOCOL.md), and the superseded [handoff](docs/CONTROL-CENTER-HANDOFF.md) kept for history. The [release record](docs/RELEASE.md) separates local proof from live deployment and campaign results.
