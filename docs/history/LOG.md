# History log

One line per ruling, in date order, with where it is recorded. NOW.md points here. A ruling lives in the commit body that applied it as `Ruling (Krish, YYYY-MM-DD): ...`; this log is the index, never a second copy of the reasoning. Newest last.

## Rulings

| Date | Ruling (Krish) | Recorded in |
|---|---|---|
| 2026-10-14 | Richly researched named warm or cold drafts are permitted; generic sequences are not | Control Center canon; AGENTS.md; docs/SOURCE-REGISTER.md |
| 2026-10-18 | Every repository has a North Star, and every session anchors to it | ddfcee4 |
| 2026-10-18 | Control Center picks each engine's next action by rule | docs/control-center/ENGINE-PROTOCOL.md (The directive) |
| 2026-10-19 | This engine runs autonomously: plan, then go-live, then live on his approved go-live | 6dafb79; AGENTS.md (Autonomy) |
| 2026-10-19 | Autonomy is given where it is deserved: check in often; low tolerance for poor creative output | 6dafb79 |
| 2026-10-19 | Krish approves or amends an engine's action on his list in Control Center | 6dafb79 |
| 2026-10-19 | "Get going" opens the repository's own plan; no pasted prompts | 962f808 |
| 2026-10-21 | One ask per engine at a time on his list; one copy of a person, stage or room | docs/control-center/ENGINE-PROTOCOL.md |
| 2026-10-21 | Outreach introduces Krish and Legibility first, explains workflow fit and pilot outcomes, and offers a 30-day free trial for feedback. A price-first opening was rejected | a611039; docs/OUTREACH-TEMPLATE.md; docs/COPY-DOCTRINE.md |
| 2026-10-23 | Every repository chases one aggressive number on a weekly ladder; urgency U1 to U5 sets how hard it pushes | d97ea02 |
| 2026-10-26 | Draft, don't send: a press places the engine's exact email as a draft in his own box | Control Center `api/_rowPress.ts` |
| 2026-10-27 | The next session investigates how the app provisions and enforces the 30-day trial, without asking first | 60f5428 |
| 2026-10-27 | The North Star number stays the scoreboard; alpha conversations held and qualified waitlist enrolments are its leading inputs | docs/ENGINE-ARCHITECTURE.md (Phase 0 commit) |
| 2026-10-27 | The waitlist is the Founding 200, and the Founding 200 offer is the 30-day free trial for feedback plus a test report on the builder's own products (one offer) | same |
| 2026-10-27 | Capacity: 5 alpha conversations a week, 25 minutes each | same |
| 2026-10-27 | An approved invitation becomes a draft in the hello mailbox through Control Center's Draft press, extended to Legibility; Krish sends. Superseded the same day by the mindmake.co mailbox row below | same |
| 2026-10-27 | Every asset and strategy the engine produces lives in Drive "Active Ventures > Legibility > 01_Growth", which the engine keeps easy to find. The folder keeps its link sharing, so Drive holds brand and strategy material only, never names or private results | same |
| 2026-10-27 | Google Analytics comes from Control Center, which already reads it; no Google credential in this repository | same |
| 2026-10-27 | The 7 expired outreach items are refreshed and resubmitted as Wave 0 | same |
| 2026-10-27 | The engine architecture plan (docs/ENGINE-ARCHITECTURE.md) is approved: "Approve, start now" | same |
| 2026-10-27 | "We need to make sure that if I've already reached out to this person for MindMake, legibility is positioned as a partner product." | PR 8; docs/COPY-DOCTRINE.md (item 11); docs/FAILURES.md F29 to F32 |
| 2026-10-27 | The opening for someone he already reached for Mindmake, approved exactly, with no word "partner": his note went, "I wrote to you in [month] about Mindmake."; they replied, "Thanks for your reply in [month] about Mindmake."; they talked, "Thanks for talking with me in [month] about Mindmake."; each then "This is a separate note about Legibility, one of the products we build at Mindmake." Any other Mindmake touch: "I'm Krish. Legibility is one of the products we build at Mindmake." | docs/OUTREACH-TEMPLATE.md (Variant); `MINDMAKE_COPY` in src/stages/prepare.mjs; docs/FAILURES.md F29 |
| 2026-10-27 | Visibility notes are not reaching out for Mindmake: podcast pitches, guest invites, press, and the notes a colleague sends for his visibility. Those people get the plain 21 October opener | docs/OUTREACH-TEMPLATE.md (Variant, Use); docs/ENGINE-ARCHITECTURE.md (Phase 1, the reader) |
| 2026-10-27 | All three holds stay: an open Mindmake item, 14 days after the last Mindmake touch, and never prepare for a Mindmake client | src/stages/prepare.mjs; docs/FAILURES.md F31 |
| 2026-10-27 | Contacts held by People, Advisory, Visibility or Events are excluded only while an item about them is open | docs/ENGINE-ARCHITECTURE.md (Invitation Researcher, G2, Phase 2 accept) |
| 2026-10-27 | Go in through commercial leaders: he is far more confident pitching commercial impact than a technical demo, and has many more commercial leaders in his network. First, commercial leaders at companies that buy product data for their own agents or products (marketplaces, comparison and affiliate sites, procurement platforms, catalogue-enrichment firms, agent startups). Commercial leaders at retailers and brands are a separate, later pool, never in the same wave. Brands wanting SEO or GEO consultancy stay excluded | docs/ENGINE-ARCHITECTURE.md (decision 12); docs/COPY-DOCTRINE.md |
| 2026-10-27 | "Test and learn what works": Wave 1 changes one variable, the impact angle (cost and speed of getting product data, revenue from agent-led buying, trust and risk of wrong prices and stock), with the audience and the offer fixed, and claims only what the pilot can measure. The 25-minute call ends with a test report on their own product pages, then an introduction to the engineer who will get the trial key; the number moves at that engineer's first trusted read from their own key | docs/ENGINE-ARCHITECTURE.md (decisions 13 and 14; section 2; Alpha Host; Phase 4) |
| 2026-10-27 | A commercial version of the outreach template is drafted for his approval | removed from docs/proposals/ when approved |
| 2026-10-27 | The commercial-leader template is approved, with three impact versions tested one per wave | docs/OUTREACH-TEMPLATE.md, Commercial-leader version |
| 2026-10-27 | Drafts land in Krish's mindmake.co mailbox. This replaces the hello mailbox, which Control Center keeps read-only and never a drafts box | docs/ENGINE-ARCHITECTURE.md (decision 16; section 8; assumption ledger) |
| 2026-10-27 | Calendly is dropped. Booking is "reply to book"; held conversations are counted from a read-only read of his Google Calendar, each event tagged with the invitation id | docs/ENGINE-ARCHITECTURE.md (decision 17; Appendix D) |
| 2026-10-27 | The runner only, for scheduled work: research, drafting and posting run inside `operate.yml`, research through Control Center's capped research desk on the engine's bearer, drafting as a headless Claude step on a spend-capped model key he adds once as an Actions secret. No interactive session holds the engine token; sessions change code only through pull requests | docs/ENGINE-ARCHITECTURE.md (decision 18; section 8; Phase 2) |
| 2026-10-27 | Merge each pull request once it is green | docs/ENGINE-ARCHITECTURE.md (decision 19; section 13) |

## Events

| Date | Event | Evidence |
|---|---|---|
| 2026-10-18 | Producer 1.0.0 built and verified locally | 37d087b; docs/RELEASE.md |
| 2026-10-19 | First live Control Center run succeeded (journal, directive, report, readback, decisions) | operate run 1 |
| 2026-10-20 to 21 | Reporting stopped for 33.5 hours: the engine required exactly protocol 1.0.0 back (`receiver_contract_mismatch`) | operate runs 2 and 3; fixed in 2b65ea6 (#6), confirmed by run 4 |
| 2026-10-21 | Seven named outreach items and one onboarding item prepared in Control Center; none decided; outreach expired 23 Oct | docs/BETA-HANDOFF.md |
| 2026-10-27 | Trial provisioning investigated (read-only): no trial exists; Free plan is the honest interim; app item A8 designed | docs/ENGINE-ARCHITECTURE.md, section 0 |
| 2026-10-27 | The Windows CI leg hung on PR 8: a temp-folder removal threw on an open journal and skipped the server close. Fixed in the guard tests; the hung runs were cancelled | docs/FAILURES.md F27 |
| 2026-10-27 | With the hang fixed, the Windows leg showed the docs check used Windows separators; its status-word rule had matched nothing there. Fixed to use '/' everywhere | docs/FAILURES.md F28 |
| 2026-10-27 | The engine reads each person's Mindmake record from the snapshot. It holds an invitation whose record is unknown, open, a client or under 14 days old, and holds everyone reached for Mindmake until Krish approves the opening words | docs/FAILURES.md F29 to F32 |
| 2026-10-27 | The runner reads each person's Mindmake record from Control Center's prior-outreach route (protocol 1.11.0, control-center PR 581) by their contact id, and copies it unchanged; anything it cannot read stays unknown and holds. No producer fills the contact id yet | docs/FAILURES.md F38; contracts/README.md |
| 2026-10-27 | The North Star number measured for the first time: 0 against 1 this week (read-only count, 20:46 UTC). Buyer v2 written to Control Center `product_icp` (20:45 UTC) | NOW.md; docs/ENGINE-ARCHITECTURE.md section 0 |
| 2026-10-27 | The engine sends each approved invitation as a protocol 1.12.0 version 2 email action when Control Center serves the Draft press (control-center PR 585, merged and deployed 27 Oct), so Clear drafts it into Krish's own Gmail; until then it sends 1.0.0 exactly as before | docs/FAILURES.md F39 to F41; contracts/README.md |
| 2026-10-27 | The runner reads Legibility's buyer, legibility.io's readings and its registered objectives from Control Center's 1.13.0 directive (control-center PR 588, merging 27 Oct; the objectives migration `20261112150000` is applied in production), and records the research desk as available; against a Control Center without 1.13.0 the run is unchanged. A current approved buyer clears `icp_not_current_approved` | contracts/README.md; docs/FAILURES.md F42, F43 |
| 2026-10-27 | Actions secrets could not be written from a session (the proxy refuses them), so the app's A4 export takes the engine's Control Center bearer until Krish adds a dedicated `LEGIBILITY_EXPORT_TOKEN` | .github/workflows/operate.yml; docs/FAILURES.md F44 |
| 2026-10-27 | Control Center's Draft press (protocol 1.12.0, control-center PR 585) merged as 23f733b and deployed; the objectives migration `20261112150000` applied to production | contracts/README.md; docs/control-center/ENGINE-PROTOCOL.md (header) |
| 2026-10-27 | The app's contract A1 to A8 shipped in legibility PRs 45 to 51 and is live, apart from A3's page, paused until the Turnstile keys exist; A8 trials are granted by hand | docs/handoff/APP-PHASE-1.md, section 12 |
| 2026-10-27 | First live run to read the app's export: Actions run 40595794935, `degraded`, `weekly_builders` measured; holds `icp_not_current_approved`, `candidate_coverage_unknown`, `opportunity_coverage_unknown` | docs/OPERATIONS.md, "What a dispatch measures today" |
| 2026-10-27 | Documentation audit applied: every doc checked against the code and live state; the dispatch facts now live once, in OPERATIONS.md | this pull request |
