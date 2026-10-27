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
| 2026-10-27 | An approved invitation becomes a draft in the hello mailbox through Control Center's Draft press, extended to Legibility; Krish sends | same |
| 2026-10-27 | Every asset and strategy the engine produces lives in Drive "Active Ventures > Legibility > 01_Growth", which the engine keeps easy to find. The folder keeps its link sharing, so Drive holds brand and strategy material only, never names or private results | same |
| 2026-10-27 | Google Analytics comes from Control Center, which already reads it; no Google credential in this repository | same |
| 2026-10-27 | The 7 expired outreach items are refreshed and resubmitted as Wave 0 | same |
| 2026-10-27 | The engine architecture plan (docs/ENGINE-ARCHITECTURE.md) is approved: "Approve, start now" | same |

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
