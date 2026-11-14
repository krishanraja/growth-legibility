---
repo: krishanraja/growth-legibility
product: Legibility growth engine
as_of: 2026-11-14
head: see Git HEAD
lifecycle: building
production_url: none
state_doc: README.md
history_log: docs/history/LOG.md
truth_files: [docs/NORTH_STAR.md]
authority_order: [docs/NORTH_STAR.md, README.md]
steward: https://github.com/krishanraja/ai-harness/blob/main/docs/steward/RUNBOOK.md
---

# Legibility growth engine: where it is right now

## What it is

Legibility's growth engine: it prepares the product tests, rich named invitations and integration recipes that earn builders' trusted reads.

## Who it is for and why it matters for Mindmake

Companies whose agents or products need product data they can trust: reached, from Wave 1, through their commercial leaders, and counted when their engineers make trusted reads. It shows Mindmake growing a developer product through useful tests rather than signups.

## Where it is right now (as of 2026-11-14)

<!-- north-star-state {"week_of": "2026-11-09", "week_target": 10, "current": null, "current_as_of": null, "current_source": null, "urgency": 4, "urgency_reason": "not measured this week; the last reading, 0 in the week of 26 October from the live run of 29 October, is 14 days old"} --> **North Star number: U4, far behind.** Builders making trusted reads every week: not measured this week (the last reading was 0 in the week of 26 October, from the live run of 29 October), against 10 this week, on the way to 300 by 28 December 2026. A bold swing every day; work that does not move the number waits. Measuring it comes first: a run started by hand measures it even while the engine is held (Waiting on Krish, below).

Held by Krish (2026-10-29): not in motion for a few weeks. Control Center sends no wake while it holds the engine, so the last live run was the dispatch of 29 October, before the hold ([OPERATIONS.md](docs/OPERATIONS.md), "What a dispatch measures today").

Lifecycle: building. The detail is in `README.md`.

- docs/control-center/ is Control Center's protocol bundle 1.33.0, byte for byte (bundle_sha256 4b7175a8aebbb8979eaefbeea1b7f0f44f2cffa0bbba9cea341da784fe7fde4d), the last protocol version of 14 November. (2026-11-14)
- docs/control-center/ is Control Center's protocol bundle 1.28.0, byte for byte (bundle_sha256 b0dfa0d7aaa10aea0de45fb5f7dcc241c62bef70766f0fed9c6351d69af1b791), with bundle.json and a hash test that fails an edit in place (integration plan I-11). (2026-11-14)
- Fleet audit repairs (14 Nov). The docs now say the 1E source review task (one-off, 17 Nov 19:23 UTC) and the disabled credits task exist (PR 31). From the review-by date every report carries one dated source review hold, which a held run names among what readiness needs (PR 30, F49). The release checklist in docs/OPERATIONS.md names the protocol re-copy (copy 1.22.0, Control Center 1.26.0) and ai_answers_detail (PR 32). One hand-started held run proved the held path live: stored held, one engine_held hold, no proposal. (2026-11-14)
- Legibility's AI answers are AEO-Engine's, the one AI-answers specialist (Ruling, Krish, 2026-11-12): each run reads its standing from the directive (protocol 1.22.0) and, once released and with real buyer questions in config/ai-answer-questions.json, asks AEO once (src/ai-answers.mjs). Held, it asks nothing. The protocol copy in docs/control-center/ is Control Center's at 36df34bc (protocol 1.22.0). (2026-11-13)
- The protocol copy in docs/control-center/ is Control Center's at 212379e1 (1.21.0, the schemas unchanged): its voice_check row lists the 16 channels Control Center accepts, and it says the directive takes weekly_builders' target from this repository's north-star block (300 by 28 December), never the registry's copy; this engine still sends at most 1.20.0. (2026-11-12)
- Every doc now says what this engine does and where it stands: held since 29 October with no live run since, protocols 1.16.0 and 1.20.0 built but not yet run live. A next step whose own deadline has passed is no longer sent to Control Center, and closeout notes now fold into NOW.md by themselves on every push to main (the fold job in .github/workflows/ci.yml). (2026-11-12)
- Protocol 1.20.0 is built on the engine side. The runner reads Krish's instruction from the directive (krish_instruction), puts one activity line first naming it by id and a digest, and acks it received, then blocked with why: "engine held" while config/activation.json holds the engine, or, released, that this runner works by rule and cannot carry out free-text words. It reports priorities (the North Star line and the recommended constraint), obsessions (Krish's quoted aims in config/engine-state.json) and next steps (GET-GOING's first unticked item and NOW.md's "Waiting on Krish") only when Control Center serves 1.20.0. His words never reach a log. The engine is still held, so Control Center sends it no instruction until he releases it there. (2026-11-11)
- The Reader Check is built and tested in shadow: fresh sub-agents read each invitation as its commercial leader or builder, from the candidate record only, and a private ledger scores their predictions against replies and first trusted reads. Not run on a live invitation; standing too_early. The engine is still held by Krish, and this changes nothing while it is. (2026-11-10)
- Claude sessions here show Krish a ChatGPT sign-in link and code whenever Codex is signed out (.claude/hooks/codex-login.sh at session start, cloud included), on his subscription, never an API key (Krish, 2026-11-10).

## What changed recently

- 2026-11-12 Krish, 2026-11-12: "make sure everything's a cohesive system and that the project documentation is 100% up to date with absolutely nothing old or misleading left in there".
- 2026-11-12 **Docs match the engine; notes fold by themselves.** Krish, 2026-11-12: "Are the project documentations up to date, 100%, every single word, with what this engine now is and how it works?" Every doc was read against the code and the live state (the Actions runs, Control Center's registry and stored reports): the versions a report sends, what the directive carries, the five registered objectives, the hold, step 3 ticked, the protocol copy at 1.21.0. A next step whose own deadline has passed ("by 5 Nov") is left out of next_steps (nextStep in src/lib/engine-state.mjs), and the fold job in ci.yml runs ai-harness's closeout hook on every push to main, as heartside and AEO-Engine do, so NOW.md, which Control Center shows on every place, stays current.
- 2026-11-11 **Krish's instruction and the engine's state (protocol 1.20.0).** Ruling (Krish, 2026-11-11): every growth engine's priorities, obsessions, next steps and outstanding items feed live across Control Centre, and Krish instructs each engine with his next best action. In his words: "make sure I can instruct each one with my next best action and have it get going (as well as always understand the current state of play and what's outstanding)". The runner acks his instruction by id and never logs his words, and reports its state from this repository's own files when Control Center serves 1.20.0 (PR 26, [contracts/README.md](contracts/README.md)). Built and tested; not run live, because Control Center sends no wake and no instruction while it holds the engine.

- 2026-11-10 **Codex signs in by itself.** A Claude session on this repository shows Krish a ChatGPT sign-in link and code at start whenever Codex is signed out (`.claude/hooks/codex-login.sh`), on his subscription, never an API key.

- 2026-11-10 **The reader check.** Ruling (Krish, 2026-11-10): fresh simulated readers read each invitation before it reaches Krish, built only from the candidate record (a commercial leader for a buyer, the builder for a builder), and say whether they would reply within 7 days, whether they would run the test this week, the weakest link and whether they felt remembered or worked, counted by impact angle (`npm run reader`, [COPY-DOCTRINE.md](docs/COPY-DOCTRINE.md), "The reader check"). In shadow, never evidence and never a Learning Judge verdict; a private ledger is scored against real replies and first trusted reads, and it earns weight or is retired by a stop rule set before its first run. Built and tested; not run on a live invitation, and it changes nothing while the engine is held.

- 2026-10-29 **Apify is a ceiling, not a pool to use up.** Ruling (Krish, 2026-10-29): Apify is pay as you go, a ceiling to stay under, and engines learn which actors are worth their cost. Each directive pool now carries `mode` (control-center PR 631): the runner says a `ceiling` pool's share is a cap, never a target (tests/credits.test.mjs), and the credits session runs Apify only for a prospect decision it needs, picks the cheapest `keep` actor from `get_apify_learnings`, trials a new one at the smallest `maxItems`, never reruns a `drop`, and settles each run with its actor, job and counts ([CREDITS-SESSION.md](docs/CREDITS-SESSION.md)). North Star check (2026-10-29): holds.

- 2026-10-29 **The credits step is built.** The runner reads its share of the prepaid credits (`readCredits`), says one line per pool, refuses a spend past the share, held or unknown, and the wire takes `credits_spent` at 1.16.0 for that field only (tests/credits.test.mjs). The runner spends nothing: a daily scheduled session spends the share through Control Center ([CREDITS-SESSION.md](docs/CREDITS-SESSION.md)), and only once the engine is released. Spending waits on Krish's release and, for Apify, his change to the Apify deny rule (the approved buyer arrived on 28 Oct). North Star check (2026-10-29): holds.

- 2026-10-29 **Held by Krish.** Ruling (Krish, 2026-10-29): Not ready means a held activation state: no wake, no asks on his list, no growth council move, and the bearer stays valid. `config/activation.json` ships held, and Control Center's hold is read from its capabilities and directive: a held run still measures, proposes nothing and reports one `engine_held` hold naming what readiness needs ([OPERATIONS.md](docs/OPERATIONS.md), FAILURES F46). `npm run check` now warns from 16 Nov, under 10 days before the source review lock of 26 Nov (FAILURES F47).

- 2026-10-27 **The app shipped its contract, A1 to A8** (legibility PRs 45 to 51), live in production apart from A3's Founding 200 page, deployed but paused until the Turnstile keys exist. A8's trial is granted by hand only, 5,000 trusted reads by default, no Stripe, `FOUNDING_AUTO_TRIAL` off. Status and what waits on Krish: [handoff/APP-PHASE-1.md](docs/handoff/APP-PHASE-1.md), section 12.

- 2026-10-27 **Control Center's side.** The Draft press (protocol 1.12.0, control-center PR 585) is merged and deployed: a prepared invitation with a contact id and a Mindmake record travels as a version 2 email action, and Krish's Clear drafts it into his own Gmail; he sends. The objectives migration `20261112150000` is applied to production. Protocol 1.13.0 (the buyer, legibility.io's readings, the research desk) is control-center PR 588, merged as `20b8b51` and deployed 28 Oct; with the engine side (PR 15), the run of 28 Oct (40607512910) read buyer v2 (`icp.state: approved`) and `icp_not_current_approved` cleared ([contracts/README.md](contracts/README.md)).

- 2026-10-27 **The number is measured: 0 against 1 this week** (read-only count at 20:46 UTC, authorised by Krish in chat). Buyer v2 was written to Control Center `product_icp` at 20:45 UTC on his authority.

- 2026-10-27 **The source review is done** (Phase 1E): `source_review_due` is 26 Nov 2026 00:00 UTC; the next review is due by 19 Nov, a session's job, never Krish's ([SOURCE-REGISTER.md](docs/SOURCE-REGISTER.md); GET-GOING, "1E again"). If it is missed, every run holds with `source_review_due` from 26 Nov and prepares nothing.

- 2026-10-27 **Krish's decisions** ([history/LOG.md](docs/history/LOG.md); [ENGINE-ARCHITECTURE.md](docs/ENGINE-ARCHITECTURE.md), decisions 12 to 19): the architecture plan is approved; from Wave 1, go in through commercial leaders at companies that buy product data, testing the impact angle; the call ends with a test report and an engineer introduction; the commercial template is approved; drafts land in his mindmake.co mailbox; booking is "reply to book"; scheduled work runs only in the runner, and no interactive session may hold the engine token; each pull request is merged once it is green. To someone he already reached for Mindmake, Legibility is positioned as a partner product, in the opening words he approved ([OUTREACH-TEMPLATE.md](docs/OUTREACH-TEMPLATE.md)).

## What is next and what is waiting on Krish

- Next (2026-11-14): refresh the copy the same way at the next protocol version; each run already says protocol_copy: current | behind <version> | unknown.
- **Waiting on Krish:**
  - release the engine when he judges it ready: set `config/activation.json` to `active` and release it on Growth > Engines; until both, it gets no wake, proposes nothing and spends nothing;
  - start Operate with Control Center by hand (Actions, then Run workflow) to measure the number while the engine is held: a held run reads the export, reports this week's `weekly_builders` and proposes nothing (OPERATIONS.md, "Held");
  - create `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` so A3's Founding 200 page can go live (also the app's own next step, its NOW.md, 12 Nov);
  - add a dedicated `LEGIBILITY_EXPORT_TOKEN` Actions secret and change the app's `GROWTH_EXPORT_TOKEN_SHA256` to its hash in the same step, so the engine's Control Center bearer stops opening the export (FAILURES F44);
  - create his MCP registry publishing key, publish `server.json` (`io.legibility/mcp` 0.4.0) and submit the directory listings (A6 and A7); the plan's 5 Nov date has passed, and whether it was met is unverified;
  - mark `generate_lead`, `sign_up` and `test_run` as key events in Google Analytics admin (A2);
  - rule on the campaign clock (GET-GOING step 4): `activated`, `returning` and `net` stay missing until it is activated;
  - say whether the outreach offer's words change now that A8 grants a real trial; the pinned template text stays as approved until he does;
  - grant each tester's trial by hand on `/dashboard/waitlist` when they accept (A8);
  - change the Apify deny rule in `.claude/settings.json`, with its check, when he wants the credits session to spend Apify (CREDITS-SESSION.md);
  - add the spend-capped `ANTHROPIC_API_KEY` as an Actions secret when Phase 2 needs it, with the cap set at the provider;
  - finish the Cowork brand-kit prompt (ENGINE-ARCHITECTURE.md, Appendix A v2): a Canva brand kit named Legibility exists, but a search of his Canva designs on 12 Nov found none of its seven designs;
  - keep `CONTROL_CENTER_ENGINE_TOKEN` out of every cloud environment's variables (only the runner holds it; ENGINE-ARCHITECTURE.md, decision 18): the Default environment holds none (read 12 Nov), and a session cannot read the others' names.
- North Star check (2026-11-14): holds.

## Read next

- `docs/NORTH_STAR.md`: the North Star, its number and its weekly ladder.
- `README.md`: what this repository is and how it runs.
- `docs/GET-GOING.md`: the build order. `docs/OPERATIONS.md`: what a live run reports today and how to run the engine.

## Do not trust

Do not treat pending outreach as fresh approval: its expiry is past. Earlier prototype/runbook status is dated evidence, not proof of current runtime state. A8's trial is live, but every grant is Krish's click: a sign-up or a pending outreach item is not proof that a tester has a trial. `docs/CONTROL-CENTER-HANDOFF.md` was superseded on 18 October by `docs/CONTROL-CENTER-BRIEF.md` and is kept for history.
