---
repo: krishanraja/growth-legibility
product: Legibility growth engine
as_of: 2026-10-27
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

## Where it is right now (as of 2026-10-27)

<!-- north-star-state {"week_of": "2026-10-26", "week_target": 1, "current": 0, "current_as_of": "2026-10-27", "current_source": "Supabase legibility: accounts with a trusted read (product returned, confidence set) since Monday 00:00 UTC, internal accounts excluded; read-only count, 2026-10-27 20:46 UTC", "urgency": 4, "urgency_reason": "0 against 1 this week, under 40%"} --> **North Star number: U4, far behind.** Builders making trusted reads every week: 0 against 1 this week (measured 27 Oct), on the way to 300 by 28 December 2026. A bold swing every day; work that does not move the number waits.

Lifecycle: building. The detail is in `README.md`.

## What changed recently

- 2026-10-27 **Documentation audit applied.** Every doc was checked against the code and the live state; what a live run reports now lives once, in [OPERATIONS.md](docs/OPERATIONS.md), "What a dispatch measures today", beside the environment, the run summary and a failure runbook. The session deny list gained Descript, a retired route.

- 2026-10-27 **The first live run read the app's export.** Actions run 40595794935 is `degraded`, not `held`: the export was read and `weekly_builders` measured, as an activity line and as an objective. It still holds `icp_not_current_approved`, `candidate_coverage_unknown` and `opportunity_coverage_unknown`, and `activated`, `returning` and `net` stay missing until the campaign clock is activated (what clears each: [OPERATIONS.md](docs/OPERATIONS.md)).

- 2026-10-27 **The app shipped its contract, A1 to A8** (legibility PRs 45 to 51), live in production apart from A3's Founding 200 page, deployed but paused until the Turnstile keys exist. A8's trial is granted by hand only, 5,000 trusted reads by default, no Stripe, `FOUNDING_AUTO_TRIAL` off. Status and what waits on Krish: [handoff/APP-PHASE-1.md](docs/handoff/APP-PHASE-1.md), section 12.

- 2026-10-27 **Control Center's side.** The Draft press (protocol 1.12.0, control-center PR 585) is merged and deployed: a prepared invitation with a contact id and a Mindmake record travels as a version 2 email action, and Krish's Clear drafts it into his own Gmail; he sends. The objectives migration `20261112150000` is applied to production. Protocol 1.13.0 (the buyer, legibility.io's readings, the research desk) is control-center PR 588, merged as `20b8b51` and deployed 28 Oct; with the engine side (PR 15), the run of 28 Oct (40607512910) read buyer v2 (`icp.state: approved`) and `icp_not_current_approved` cleared ([contracts/README.md](contracts/README.md)).

- 2026-10-27 **The engine reads each person's Mindmake record from Control Center** (control-center PR 581, protocol 1.11.0), by contact id, unknown on any failure. No producer fills the contact id yet.

- 2026-10-27 **The number is measured: 0 against 1 this week** (read-only count at 20:46 UTC, authorised by Krish in chat). Buyer v2 was written to Control Center `product_icp` at 20:45 UTC on his authority.

- 2026-10-27 **The source review is done** (Phase 1E): `source_review_due` is 26 Nov 2026 00:00 UTC; the next review is due by 19 Nov ([SOURCE-REGISTER.md](docs/SOURCE-REGISTER.md); GET-GOING, "1E again"). If it is missed, every run holds with `source_review_due` from 26 Nov and prepares nothing.

- 2026-10-27 **Krish's decisions** ([history/LOG.md](docs/history/LOG.md); [ENGINE-ARCHITECTURE.md](docs/ENGINE-ARCHITECTURE.md), decisions 12 to 19): the architecture plan is approved; from Wave 1, go in through commercial leaders at companies that buy product data, testing the impact angle; the call ends with a test report and an engineer introduction; the commercial template is approved; drafts land in his mindmake.co mailbox; booking is "reply to book"; scheduled work runs only in the runner, and no interactive session may hold the engine token; each pull request is merged once it is green. To someone he already reached for Mindmake, Legibility is positioned as a partner product, in the opening words he approved ([OUTREACH-TEMPLATE.md](docs/OUTREACH-TEMPLATE.md)).

- 2026-10-27 **Beta handoff recorded** ([BETA-HANDOFF.md](docs/BETA-HANDOFF.md)): seven private outreach items (expired 23 Oct) and one onboarding item wait in Control Center. The trial investigation it authorised is done; its design shipped as A8.

- 2026-10-23 **The North Star has a number, a weekly ladder and an urgency rating** (Ruling, Krish, 2026-10-23; `docs/NORTH_STAR.md`).

## What is next and what is waiting on Krish

- **Single next step:** GET-GOING's first unticked item, Phase 1B's attribution fields: accept `accounts[].attribution` and `reads[].key_id` in `src/guards/wire.mjs` and name them in `contracts/README.md`, so the export client can ask with `fields=attribution` and each builder's first read traces to the invitation that earned it. After it, Phase 2's research step is the candidate source every export-fed run lacks (`candidate_coverage_unknown`), and it carries the Control Center contact id the Mindmake record and the Draft press need.
- **Waiting on Krish:**
  - remove `CONTROL_CENTER_ENGINE_TOKEN` from this cloud environment's variables (the environment menu in the session's title bar, then Edit): an interactive session held it on 27 Oct, against the rule that only the runner does (ENGINE-ARCHITECTURE.md, decision 18);
  - add a dedicated `LEGIBILITY_EXPORT_TOKEN` Actions secret and change the app's `GROWTH_EXPORT_TOKEN_SHA256` to its hash in the same step, so the engine's Control Center bearer stops opening the export (FAILURES F44);
  - create `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` so A3's Founding 200 page can go live;
  - create his MCP registry publishing key, publish `server.json` (`io.legibility/mcp` 0.4.0) and submit the directory listings by 5 Nov (A6 and A7);
  - mark `generate_lead`, `sign_up` and `test_run` as key events in Google Analytics admin (A2);
  - re-review Legibility's buyer in Growth > Buyers by about 26 Nov: the engine counts it as current for only 30 days after its `reviewed_at`, and buyer v2 was saved on 27 Oct, so after that every run holds `icp_not_current_approved` again (OPERATIONS.md, "What a dispatch measures today");
  - rule on the campaign clock (GET-GOING step 4): `activated`, `returning` and `net` stay missing until it is activated;
  - say whether the outreach offer's words change now that A8 grants a real trial; the pinned template text stays as approved until he does;
  - grant each tester's trial by hand on `/dashboard/waitlist` when they accept (A8);
  - add the spend-capped `ANTHROPIC_API_KEY` as an Actions secret when Phase 2 needs it, with the cap set at the provider;
  - run the Cowork brand-kit prompt.
- North Star check (2026-10-27): holds. The number is measured at 0 against 1 this week (U4); the engine now counts it from the app's export every day, and the next steps above (attribution, then a candidate source) are what let it prepare invitations that move it.

## Read next

- `docs/NORTH_STAR.md`: the North Star, its number and its weekly ladder.
- `README.md`: what this repository is and how it runs.
- `docs/GET-GOING.md`: the build order. `docs/OPERATIONS.md`: what a live run reports today and how to run the engine.

## Do not trust

Do not treat pending outreach as fresh approval: its expiry is past. Earlier prototype/runbook status is dated evidence, not proof of current runtime state. A8's trial is live, but every grant is Krish's click: a sign-up or a pending outreach item is not proof that a tester has a trial.
