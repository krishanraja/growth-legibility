# The credits session: spend Legibility's share of the prepaid credits

Ruling (Krish, 2026-10-29): a growth engine may spend up to its placement share of a tool's prepaid credits each cycle with no per-batch approval, and reports what it made (protocol 1.16.0, [ENGINE-PROTOCOL.md](control-center/ENGINE-PROTOCOL.md), "Prepaid credits"). The runner on GitHub holds no Apify or 21st Dev key, so the spending is done by one scheduled Claude session a day for this engine, with the Control Center, Apify and 21st Dev connectors attached (Krish, 2026-10-29: "Scheduled sessions"). That session follows this file.

**This engine is held** ([AGENTS.md](../AGENTS.md), "Held"; `config/activation.json`). While it is held, the session reads the share, says so, and spends nothing. Its scheduled task is created disabled and stays that way until Krish releases the engine.

## Before the first spend (release prerequisites)

- Krish releases the engine in both places: `config/activation.json` reads `active`, and Growth > Engines in Control Center shows it active.
- Control Center serves a current approved Legibility buyer in the directive (`icp`, status `approved`). With none, Apify prospect research does not run.
- Krish relaxes the Apify deny rule. This repository's `.claude/settings.json` denies `mcp__Apify__call-actor` in sessions on it, and `npm run check:docs` holds that list. A run on Apify needs his change to that rule and to the check in the same pull request. Until then only 21st Dev work runs.

## Each run

1. **Read the share.** `get_engine_credits({ engine: 'legibility' })` through the Control Center connector. Stop with one line if it says `held: true`, if `credits` is null (unknown, never a share of zero), or if no pool has anything left.
2. **Pace it.** For each pool, today's budget is `remaining_for_you / days_left`. In the last three days before `use_by`, the budget is everything left. Credits left at the reset are money lost.
3. **Choose the work** that moves `weekly_builders` first:

   | Pool | What to make | Never |
   |---|---|---|
   | Apify (main) | Builder discovery and prospect research inside the current approved buyer from Control Center: public builder directories, repositories and launch pages, through existing actors with their own run caps | People outside the approved buyer, private data, an address on its own |
   | 21st Dev (main) | Interface component drafts for legibility.io, once the design is decided | A deploy or a merge without review |

4. **Reserve, run, settle.** Before every generation or actor run, call `reserve_credit_spend({ engine: 'legibility', pool, amount, asset, objective_key })` with the expected cost. Control Center refuses it past `remaining_for_you`, while held, or with the block unknown, and holds one open reservation at a time. Run the work. Then call `settle_credit_spend({ spend_id, amount, receipt })` with the provider's actual cost and its run or job ids; pass `amount: 0` when it failed or nothing was charged, which voids it.
5. **Keep it.** Results stay private: in the provider's own storage, or under `runtime/` on a machine that runs this engine. Never commit a person, an address, a dataset or a figure (AGENTS.md).
6. **Close.** End with one line: what was made, from which pool, the amount, and what is left.

## The walls

- Never past `remaining_for_you`. Apify usage over the $29 included is new money.
- Never a top-up, a plan change or new money.
- Nothing made is sent, posted or published. A dataset or a component is prepared work; the send, post and spend walls stay where they are.
- A spend recorded here is never also put in a runner report's `credits_spent`: Control Center counts both, so it would be counted twice. The runner (`src/lib/cc-signals.mjs`, `readCredits`) reads the share, writes one activity line per pool and spends nothing.
