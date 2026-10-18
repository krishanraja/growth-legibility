# Legibility growth engine

An executable, evidence-led growth producer for [Legibility](https://legibility.io). It prepares qualified acquisition work, measures trusted product use, produces consent-safe benchmark aggregates and selects the next funnel constraint. It reports to a proposed product-scoped Control Center receiver.

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

Only after the receiver has been built, independently tested and activated:

```sh
node src/cli.mjs deliver --run-id RUN_ID --out runtime/live
```

Delivery reads `LEGIBILITY_CC_TOKEN` from the runtime environment. It negotiates the exact receiver contract, reconciles existing state, writes idempotently and requires an independent stored digest readback. There is no email sender, publisher, purchase executor or recurring schedule in this repository.

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
| Report reliably | Immutable run envelope, private SQLite transport spool, three total delivery attempts across restarts and independent readback |

This producer accepts source-owned snapshots. It does not pretend to discover prospects, verify emails or instrument the production app from a fixture. Current canonical ICP state, private source access, `/builders-beta`, report saving, referral flow and the Control Center consumer require their owning app/runtime changes before a live campaign can operate. Those are concrete activation prerequisites in the handoff.

## Ownership and next deployment

Control Center keeps the one private dashboard, source state and human approval queue. The engine is intended as a job under its existing growth owner, Maya, after live roster verification. SQLite here stores immutable delivery bytes and retry state only.

Read the [accepted brief](docs/BRIEF.md), [operations guide](docs/OPERATIONS.md), [source register](docs/SOURCE-REGISTER.md), [contract guide](contracts/README.md) and the complete [Control Center implementation handoff](docs/CONTROL-CENTER-HANDOFF.md). The [release record](docs/RELEASE.md) separates local proof from live deployment and campaign results.
