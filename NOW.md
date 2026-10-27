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

- 2026-10-27 **Approved invitations are ready for Control Center's Draft press** (protocol 1.12.0; control-center PR 585 at `efad466`, open). When the capabilities say `features.draft_press: true` and Control Center serves and takes 1.12.0, `operate` sends each approved invitation as a version 2 email action: the candidate's contact id as recipient and `subject_ref`, the approved subject and words unchanged, `mailbox: "krish"`, the Mindmake record copied unchanged, and the template's git blob SHA as `source_revision`. Krish's Clear then drafts it into his own Gmail, after Control Center re-reads the record. The wire validator checks every action before it is posted; a candidate without both a contact id and a record never gets one. Until PR 585 deploys, every run sends 1.0.0 exactly as before ([contracts/README.md](contracts/README.md), FAILURES F39 to F41). Checked against Control Center's own parser and press at `efad466`: both a never-reached and a reached-for-Mindmake invitation parse, keep their digest and draft.

- 2026-10-27 **The engine reads each person's Mindmake record from Control Center** (control-center PR 581 merged, protocol 1.11.0). A candidate may carry its Control Center contact id (`contact.contact_id`), and `operate` reads `GET .../prior-outreach` by those ids, at most 50 a read, and copies each record unchanged into `contact.prior_mindmake`. A failed read, a missing capability, a malformed record or no contact id leaves the record absent, which holds as `mindmake_history_unknown`; nothing writes `none` on a failure ([contracts/README.md](contracts/README.md), FAILURES F38). No producer fills the contact id yet, so live runs are unchanged.

- 2026-10-27 **The number is measured: 0 against 1 this week** (read-only count at 20:46 UTC, authorised by Krish in chat). Buyer v2 was written to Control Center `product_icp` at 20:45 UTC on his authority; the read-back shows it defined, with 10 titles.

- 2026-10-27 **The source review is done** (Phase 1E): register reviewed against both repositories' current heads, review date moved to 26 Nov 2026 with its reasons, manifest refrozen. Details under "What is next".

- 2026-10-27 **The app contract brief is written** ([handoff/APP-PHASE-1.md](docs/handoff/APP-PHASE-1.md)): A1 to A8 for a session in the Legibility app repository, each with its reason, behaviour, data shape, acceptance tests and what Krish approves, in the order A1, A2, A4, then A6 and A7 by 5 Nov, then A3 and A8. Its A4 export matches this engine's snapshot contract, proved by composing a synthetic export and running `validateSnapshot` and measure on it. It carries Krish's 27 Oct rulings that bind the app (commercial leaders first with the introduced engineer as the key holder, the Founding 200 offer, reply to book, drafts in his mindmake.co mailbox). Nothing is built or deployed.

- 2026-10-27 **Krish chose the commercial-leader route** ([ENGINE-ARCHITECTURE.md](docs/ENGINE-ARCHITECTURE.md), decisions 12 to 19; [history/LOG.md](docs/history/LOG.md)).
  - From Wave 1, go in through commercial leaders at companies that buy product data for their own agents or products. Retailers and brands are a separate, later pool, never in the same wave.
  - "Test and learn what works": Wave 1's one variable is the impact angle (cost and speed, revenue from agents, trust and risk), with the audience and the offer fixed, and only claims the pilot can measure.
  - The 25-minute call ends with a test report on their own product pages, then an introduction to the engineer who gets the trial key. The number moves at that engineer's first trusted read.
  - The commercial template is approved (27 Oct): [OUTREACH-TEMPLATE.md](docs/OUTREACH-TEMPLATE.md), "Commercial-leader version", with three impact versions tested one per wave.
  - Drafts land in his mindmake.co mailbox. Booking is "reply to book". Scheduled research, drafting and posting run only in the runner; no interactive session holds the engine token. Each pull request is merged once it is green.

- 2026-10-27 **Ruling (Krish, 2026-10-27): to someone Krish already reached for Mindmake, Legibility is positioned as a partner product.** His words: "We need to make sure that if I've already reached out to this person for MindMake, legibility is positioned as a partner product."
  - The snapshot now carries each person's Mindmake record (`contact.prior_mindmake`), copied from Control Center ([contracts/README.md](contracts/README.md)).
  - Krish approved the opening words the same day ([OUTREACH-TEMPLATE.md](docs/OUTREACH-TEMPLATE.md), "Variant: someone Krish has already reached for Mindmake"). Someone reached for Mindmake reaches his list only with the two lines for their record, with its month; visibility notes (podcast pitches, guest invites, press, a colleague's visibility notes) do not count, so those people get the plain 21 October opener. Contacts other teams hold are excluded only while an item about them is open.
  - The engine holds an invitation whose record is unknown, open, a Mindmake client or under 14 days old, and never names Mindmake to anyone else. The send proposal Krish sees says what the record shows and links it in its evidence; the words sent never carry the link.
  - Items prepared by hand, such as Wave 0, pass `npm run check:invitation` first: prepare's whole per-candidate gate, on the real clock, against records read that day.

- 2026-10-27 **The engine has an approved architecture and Phase 0 is built.**
  - Ruling (Krish, 2026-10-27): the plan in [ENGINE-ARCHITECTURE.md](docs/ENGINE-ARCHITECTURE.md) is approved. The engine is aimed at alpha conversations and a qualified Founding 200 waitlist, with the weekly number as the scoreboard.
  - Phase 0 (no behaviour change) added:
    - the failure register ([FAILURES.md](docs/FAILURES.md)) and the rulings log ([history/LOG.md](docs/history/LOG.md));
    - a CI-only docs check;
    - the session deny list;
    - 40 new tests: 33 guard tests and 7 docs-check tests, each seen to fail when its guard is broken;
    - the Drive Growth folder (`Active Ventures > Legibility > 01_Growth`, brand and strategy only).
  - The trial investigation found no trial in the app. The Free plan is today's honest offer (up to 1,000 trusted reads a month), and the real trial is app item A8.

- 2026-10-27: recorded the [beta handoff](docs/BETA-HANDOFF.md) and approved 30-day free trial [outreach template](docs/OUTREACH-TEMPLATE.md). Five customer drafts, two warm introduction notes, two measured demo packs and one onboarding template remain private in Control Center. Fresh metadata check: outreach is still pending but its 23 October expiry is past. No sending or account provisioning occurred in this work; trial enforcement remains unverified.

- 2026-10-23 **The North Star now has a number, a weekly ladder and an urgency rating.** Ruling (Krish, 2026-10-23): every repository chases one aggressive number on a weekly ladder, and urgency U1 to U5 sets how hard it pushes. The number is in `docs/NORTH_STAR.md`; contract: ai-harness `contract/north-star-metric.md`.

## What is next and what is waiting on Krish

- **Next (Week 0, plan section 0):**
  - measured 27 Oct: 0 (week target 1). Context: there has been no API call since 21 Oct, the one live key is internal, and the waitlist is empty. Re-measure each Monday until the A4 export replaces it;
  - the export client is built (Phase 1B, 27 Oct): once the app ships A4 and Krish adds `LEGIBILITY_EXPORT_TOKEN` (Actions secret) and `LEGIBILITY_EXPORT_URL` (variable), each run counts `weekly_builders`; until then the live report is unchanged;
  - then the rest of Phase 1 (app contract A1 to A8, Control Center asks: the research desk for this engine and a read-only calendar read; the Draft press into his mindmake.co mailbox is built on both sides and waits on control-center PR 585);
  - the 7 expired outreach items are refreshed in the runner once its propose step exists (Phase 2), never from an interactive session.
- **Waiting on Krish:**
  - add the spend-capped model API key (`ANTHROPIC_API_KEY`) as an Actions secret when Phase 2 needs it, with the cap set at the provider;
  - run the Cowork brand-kit prompt.
- **Single next step for the Mindmake ruling:** a producer for each candidate's Control Center contact id. Control Center's reader, route and one-list hold are merged (PR 581) and the engine reads the route (27 Oct), but no candidate carries a `contact_id` yet: the app export owns no candidates, so they reach the runner only in a `--snapshot` file. Phase 2's research and propose step in the runner carries the id from Control Center (a contact Krish already has, or one the research desk's `person_route` files); until then every Wave 0 item holds as `mindmake_history_unknown`. Control Center still owes ask 5 (`contact_id` on People-press drafts, so their open check keys by contact).
- **Single next step for the Draft press:** Krish reviews and merges control-center PR 585. Once it deploys, the next `operate` run reads `features.draft_press` and sends version 2 email actions with no change here; no session posts one by hand. It drafts nothing live until a candidate carries a `contact_id` (Phase 2's research step, the next step for the Mindmake ruling above).
- North Star check (2026-10-27, Draft press): holds. It turns each approved invitation into a Gmail draft in Krish's own box with one press, once PR 585 deploys; it does not move the number by itself.
- **Resolved:** the hello mailbox. Krish ruled on 27 October that drafts land in his mindmake.co mailbox; the hello mailbox stays read-only, as Control Center keeps it.
- North Star check (2026-10-27): holds.
- North Star check (2026-10-27, Mindmake ruling): holds. This protects the quality of each invitation; it does not move the number by itself.
- North Star check (2026-10-27, Mindmake variant approved): holds. People reached for Mindmake can now be invited once the reader lands; it does not move the number by itself.
- North Star check (2026-10-27): holds; commercial-leader route chosen; the number still unmeasured (U4).
- **Single next step for the app contract:** Krish opens a session in the Legibility app repository and points it at [handoff/APP-PHASE-1.md](docs/handoff/APP-PHASE-1.md); it starts with the read-only source review read (its section 11) and A1, and asks him once per deploy.
- North Star check (2026-10-27, app brief): holds. A1, A2 and A4 are the critical path to measuring the number; the brief moves it only once they are deployed.
- **Done 27 Oct 2026, the source review (Phase 1E; [SOURCE-REGISTER.md](docs/SOURCE-REGISTER.md), "Review of 27 October 2026").** The four app files were reviewed at the app's `main` head `ffe7cda` (three unchanged; the North Star gained its number, 1,000 production agents a week by 29 March 2027) and the two Control Center rows at `621bad8` (the receiver is live, the packs collision is gone, the attribution allowlist still omits Legibility). No changed claim alters what a run does. `source_review_due` is now 26 Nov 2026 00:00 UTC, 30 days after the review; the manifest is refrozen with both examples rebuilt. **Next review due by 19 Nov 2026; if it is missed, from 26 Nov 00:00 UTC every run holds with `source_review_due` and prepares nothing.**
- North Star check (2026-10-27, export client): holds. The engine can now count the number from the app's export; it is measured once A4 ships and the secret is added.
- North Star check (2026-10-27, source review): holds. It keeps every run able to prepare past 17 Nov; it does not move the number by itself.
- North Star check (2026-10-27, measured): holds; the number is 0 against 1, U4.
- North Star check (2026-10-27, Mindmake reader): holds. People reached for Mindmake can be invited once a contact id reaches the runner; it does not move the number by itself.

- **Start here next session, already authorised by Krish on 27 October:** investigate how the Legibility app can provision and enforce the 30-day free trial. Establish activation, usage allowance, dates, expiry and billing safeguards. Do not ask whether to start or continue. The previous session is closed; see docs/BETA-HANDOFF.md for scope and authority.

- Resume from docs/BETA-HANDOFF.md: refresh expired outreach and current contact/approval state; inspect trial provisioning before promising activated access. Do not count internal demos as builder adoption.

- North Star check (2026-10-23): holds.

## Read next

- `docs/NORTH_STAR.md`: the North Star, its number and its weekly ladder.
- `README.md`: what this repository is and how it runs.

## Do not trust

Do not treat pending outreach as fresh approval: its expiry is past. Earlier prototype/runbook status is dated evidence, not proof of current runtime state. The public Free plan is not proof of an enforced 30-day beta entitlement.
