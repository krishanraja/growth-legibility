# Get going

When Krish opens this repository and says "Get going", this is the work. AGENTS.md says how to use it; this file says what to do. Written 2026-10-19 by Control Center, from this engine's first live reports.

## What "Get going" does

1. Read AGENTS.md to the end (it records Krish's rulings), then docs/NORTH_STAR.md. Say in one line which part of the North Star this run moves.
2. Do the first unticked step of **The build** below, completely: to its checks and one pull request. Tick it in that same pull request, with a one-line note of what it changed in the live report. If a step is blocked on something only Krish can do (a secret, a ruling), say exactly what in the pull request and on his list in Control Center, tick nothing, and go on to the next step.
3. Stop after one step, unless it took under an hour and the next step needs nothing from him.
4. When every step is ticked, "Get going" means: read the engine's latest live report and today's directive, find what most limits tomorrow's report (an unknown objective, a held proposal, a weak go-live, a check-in he declined), fix that, and add it here as a ticked step.

Never ask Krish to paste a prompt or repeat a brief: everything needed is in this repository.

## The brief

**The approved plan (27 Oct 2026) is [ENGINE-ARCHITECTURE.md](ENGINE-ARCHITECTURE.md).** Its phases below are the build; the original steps 0 to 5 are kept and mapped into them. Week 0 (section 0 of the plan) runs alongside Phase 0. Control Center now serves protocol 1.9.0; read its copy at `docs/control-center/ENGINE-PROTOCOL.md`.

For beta outreach/onboarding continuation, first read [BETA-HANDOFF.md](BETA-HANDOFF.md). The 27 October handoff records completed private preparation and expired outreach timestamps. It does not tick the engine implementation steps below.

Read AGENTS.md first and follow it (it records Krish's rulings of 2026-10-19), then docs/NORTH_STAR.md, docs/CONTROL-CENTER-BRIEF.md and docs/control-center/ENGINE-PROTOCOL.md (protocol 1.1.0). Before you start, say which part of the North Star this work moves.

Where things stand (2026-10-19): this engine runs the Control Center loop live. Every day at 05:10 UTC Control Center writes this engine a directive and wakes `.github/workflows/operate.yml` (`node src/cli.mjs operate`) with a `cc-growth-directive` repository_dispatch. The first live run on 2026-10-19 succeeded: it journaled its attempt, read the directive, sent a report, read it back by digest and read Krish's decisions. Control Center now speaks protocol 1.1.0: send `schema_version: "1.1.0"`, and read `stage`, `amended`, `exact_payload`, `amount_usd` and `amended_sha256` from decisions.

The job now is to make the daily report worth Krish's morning. Every run should leave Control Center with:

1. Every objective measured honestly: a real value with its window and timezone, or `value: null` with a specific reason. Never a zero you did not measure.
2. One best recommendation plus a few alternatives as `proposals[]` (at most 10). Each one names its `objective_key`, says why in plain words, links its evidence (https only), says its `kind` (advice, prepared or autonomous), names the event that proves it done in `close_condition`, and has an `expires_at`. Control Center picks tomorrow's next action by rule: first what Krish approved and you have not done, then a repair if the engine is failing, then the unwalled proposal on the objective with the widest gap. So make the move you most want done unwalled where you can, and aim it at the widest gap.
3. Anything behind a wall (`wall`: send, post, spend or strategy) complete enough that his yes is the whole decision: the exact words in `exact_payload`, the channel, `amount_usd` for spend, and the evidence. It lands on his one list in Control Center, where Clear approves exactly that payload, "Change it first" lets him approve his own version, and Purge declines it. Keep a proposal's `proposal_id` stable across runs: if the words change, the new `payload_sha256` sends it back to him, and his earlier yes and any version of his no longer apply.
4. `events[]` for what closed, with evidence, naming the proposal_id and the event in its close_condition.
5. `holds[]` for anything set aside, each with a reason code and one plain sentence.

Acting on his decisions: this engine is autonomous (AGENTS.md, "Autonomy"), and autonomy is given where it is deserved. Build the whole loop:
- **Plan** (`stage: "plan"`, behind `strategy`, the plan in `exact_payload`): what the engine is going to do, aimed at the objective with the widest gap. Wait for his yes.
- **Go-live** (`stage: "go_live"`, `parent_proposal_id` = the plan, behind `send`, `post` or `spend`): once the plan is approved, build everything up to go-live and propose it for his review, with the exact words, the assets and the amount, and the quality review in its evidence. Nothing goes out yet.
- **The go-live step**: when a decision approves a go-live whose `payload_sha256` matches, publish, send or spend exactly that, once, through the channel it names, then report the closing event with evidence. When `amended` is true, recompute `amended_sha256` (SHA-256 of canonical JSON of exactly `{"amount_usd": ..., "exact_payload": ...}`) and use his version, never yours. Purge means stop. Never go live from an approved plan, an interactive session or a prompt. If a channel needs a credential the runner lacks, report a hold naming the exact secret Krish must add; never ask for a value.
- **Check-ins** (`stage: "check_in"`, behind `strategy`, naming the plan, with how it is going and what comes next in `exact_payload`) at the cadence AGENTS.md sets. His yes keeps the plan going, his amendment redirects it, his no stops it for good.
- **The quality bar** in AGENTS.md holds before any go-live is proposed. Hold work below it, with its reason. Record each of his amendments and declines where the next draft reads it.

Rules that do not move:
- This repository is public. Synthetic fixtures only. No live people, drafts, business figures, tokens or production receipts in code, tests, logs, artifacts or pull requests. Public Actions logs carry counts and codes only.
- Never print or commit `CONTROL_CENTER_ENGINE_TOKEN`. This task has no token and needs none: prove every change against the repository's local protocol stand-in (`tests/standin.mjs`). The only live writes are the scheduled Actions run and the workspace runs Krish starts.
- Never retry a write blindly. After a timeout or a 409, read back first.
- Plain English, no em dashes.

Finish with the checks below passing and one pull request whose description says, in plain words, what tomorrow's live report will say that today's did not.

### This engine

Today's live report (2026-10-19) was `held`, and all three objectives are missing (`activated`, target 75; `returning`, target 30; `net`, target 200):
- `source_snapshot_missing`: the runner has no authenticated export from the app (accounts, server-metered reads, events, settlements).
- `icp_not_current_approved`: no approved Legibility buyer definition has reached the runner, so prospecting stays held.
- The campaign clock in `config/policy.json` is not started. Starting it is Krish's decision.
- Proposal: "Connect the app snapshot export and the product_icp read path to this runner".

## The build

- [x] **Step 0.** Correct the status line at the top of docs/CONTROL-CENTER-BRIEF.md: the first live run on 2026-10-19 succeeded, so it is no longer only tested against a local stand-in. *Done in Phase 0 (27 Oct): the brief now says live since 19 Oct, and the reports stay `held` until the snapshot and ICP arrive.*
- [x] **Step 0a. Ruling (Krish, 2026-10-27): to someone Krish already reached for Mindmake, Legibility is positioned as a partner product.** The Mindmake record in the snapshot (`contact.prior_mindmake`, contracts/README.md), the four holds and six draft lints in prepare, `npm run check:invitation` for items prepared by hand, the manifest refreeze and the registers (FAILURES F29 to F32). *Done in PR 8 (27 Oct): the send proposal Krish sees says what Control Center records about Mindmake and links the record in its evidence; the words sent never carry the link. An invitation whose record is unknown, open, a client or under 14 days old is held, and anyone reached for Mindmake, on a first invitation or a follow-up, is held unless the opening is exactly the words Krish approved (Step 0b).*
- [x] **Step 0b. PR B: Krish's variant words.** Krish approved the opening sentences on 27 October 2026. They are in docs/OUTREACH-TEMPLATE.md (its 21 October block stays byte for byte) and in `MINDMAKE_COPY`; `tests/docs.test.mjs` pins both, and `src/stages/prepare.mjs` is refrozen. Visibility notes do not count as reaching out for Mindmake, all three holds stay, and contacts other teams hold are excluded only while an item about them is open (`docs/history/LOG.md`, 27 Oct rulings).
- [ ] **Step 1.** The autonomy loop above (plan, go-live, the go-live step, check-ins) on protocol 1.1.0, proved against the stand-in: an approved plan never goes live, an approved go-live goes live once with exactly its payload, an amended one goes live in his words, a declined check-in stops its plan.
- [ ] **Step 2.** Specify the snapshot. Write the exact export contract the Legibility app must produce (fields, windows, auth) into docs, and make `--snapshot` consume it. The app is another repository: do not edit it. Hand its owner the contract as a proposal.
- [ ] **Step 3.** Propose the Legibility ICP to Krish as `wall: strategy`, with its evidence, so he can approve it on Control Center's Growth > Buyers. Code the ICP read against the documented `product_icp` shape, so prospecting releases on its own once Control Center serves that read.
- [ ] **Step 4.** Keep the campaign-clock proposal on his list. When his approval arrives in decisions, start the clock and measure from that date.
- [ ] **Step 5.** Make the daily recommendation one rich named invitation or product test, prepared, tied to `activated`.

## The phases (from ENGINE-ARCHITECTURE.md, section 11)

Each phase is one pull request with its acceptance tests set before it starts. The original steps map in brackets.

- [x] **Phase 0. Lose nothing** (step 0). Registers (`docs/FAILURES.md`, `docs/history/LOG.md`), the filed plan, drift fixes, the protocol copy at 1.9.0, `npm run check:docs` in CI only, the session deny list (`.claude/settings.json`), the Drive taxonomy (`librarian/drive-taxonomy.json`), tests for the guards that had none, and the Drive Growth folder.
- [ ] **Phase 1. Measure and attribute, plus the registry track** (step 2). The app contract A1 to A8 handed to a Legibility session; the engine's export client and the Google Analytics read through Control Center; the session ledger; directory artefacts by 5 Nov; the source review by 10 Nov; the Control Center asks, now including the Mindmake record's reader, its route, the one-list hold and the Draft press checks.
- [ ] **Phase 2. The signed spec and the autonomy loop** (steps 1, 3 and 4). Spec schema and digest binding, protocol fields, the G2 bundle with expiry and re-read, the Draft press route, `propose` for sessions, the ICP read or its shown fallback, the campaign clock proposal.
- [ ] **Phase 3. Crew, invariants, computed readiness, pack and harness.**
- [ ] **Phase 4. Alpha Wave 1** (step 5). The new route proves itself on a real run.
- [ ] **Phase 5. Volume:** directories live, recipes, partners, Show HN, returning-builder nudges.
- [ ] **Phase 6. Ranker and live Codex dispatch.**

## Checks

`npm run check`, `npm test`, `npm run conveyor`, `npm run demo`.
