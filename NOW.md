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

Developers building software agents. It shows Mindmake growing a developer product through useful tests rather than signups.

## Where it is right now (as of 2026-10-27)

<!-- north-star-state {"week_of": "2026-10-26", "week_target": 1, "current": null, "current_as_of": null, "current_source": null, "urgency": 4, "urgency_reason": "not measured yet"} --> **North Star number: U4, far behind.** Builders making trusted reads every week: not measured yet, against 1 this week, on the way to 300 by 28 December 2026. A bold swing every day; work that does not move the number waits.

Lifecycle: building. The detail is in `README.md`.

## What changed recently

- 2026-10-27 **Ruling (Krish, 2026-10-27): someone already reached for Mindmake hears of Legibility as a Mindmake product.** His words: "We need to make sure that if I've already reached out to this person for MindMake, legibility is positioned as a partner product."
  - The snapshot now carries each person's Mindmake record (`contact.prior_mindmake`), copied from Control Center ([contracts/README.md](contracts/README.md)).
  - The engine holds an invitation whose record is unknown, open, a Mindmake client or under 14 days old. It holds everyone reached for Mindmake until Krish approves the opening words, never names Mindmake to anyone else, and links the record in each invitation.
  - Items prepared by hand, such as Wave 0, pass `npm run check:invitation` first.

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
  - measure the number by hand, through two owner-approved Control Center gateway reads;
  - refresh the 7 expired outreach items in a session that holds the engine token;
  - then Phase 1 (app contract A1 to A8, Control Center asks).
- **Waiting on Krish:**
  - approve the two gateway reads;
  - define Legibility's buyer in Control Center Growth > Buyers (proposed wording in Drive `01_Growth/01_Strategy`);
  - create the Calendly "Legibility alpha test" event by hand (settings in the same folder);
  - run the Cowork brand-kit prompt;
  - review and merge the Phase 0 pull request.
- **Single next step for the Mindmake ruling:** Krish approves the opening words for people already reached for Mindmake (GET-GOING step 0b). Wave 0 items for those people wait on his words. Control Center's reader, route and one-list hold (ENGINE-ARCHITECTURE section 11, Phase 1 asks) are the other half; until the reader exists, each Wave 0 record comes from owner-approved gateway reads, and doubt reads as unknown.
- **Also waiting on Krish:** whether contacts that People, Advisory, Visibility or Events hold are excluded only while an item about them is open (ENGINE-ARCHITECTURE section 0, item 8).
- North Star check (2026-10-27): holds.
- North Star check (2026-10-27, Mindmake ruling): holds. This protects the quality of each invitation; it does not move the number by itself.

- **Start here next session, already authorised by Krish on 27 October:** investigate how the Legibility app can provision and enforce the 30-day free trial. Establish activation, usage allowance, dates, expiry and billing safeguards. Do not ask whether to start or continue. The previous session is closed; see docs/BETA-HANDOFF.md for scope and authority.

- Resume from docs/BETA-HANDOFF.md: refresh expired outreach and current contact/approval state; inspect trial provisioning before promising activated access. Do not count internal demos as builder adoption.

- Measure the North Star number and record it on the first line under "Where it is right now".
- North Star check (2026-10-23): holds.

## Read next

- `docs/NORTH_STAR.md`: the North Star, its number and its weekly ladder.
- `README.md`: what this repository is and how it runs.

## Do not trust

Do not treat pending outreach as fresh approval: its expiry is past. Earlier prototype/runbook status is dated evidence, not proof of current runtime state. The public Free plan is not proof of an enforced 30-day beta entitlement.
