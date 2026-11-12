# Producer release 1.0.0

Built 18 October 2026 for the explicitly requested growth-legibility repository.

## Verified locally

The release is accepted only after check, all focused/integration tests, conveyor topology validation and the full synthetic CLI demonstration pass. Tests exercise actual loopback HTTP receiver persistence and independent readback, ambiguous-response recovery and restart-persistent retry limits. Corpus bytes are compared to the supplied attachment and the manifest.

All 75 local tests passed at this release (54 at the first release, 17 added with the Control Center protocol on 2026-10-19, 4 added with the copywriting corpus on 2026-10-19). Later suites are counted by `npm test`, not written here. Syntax, policy, snapshot, privacy scan, original corpus integrity, six-stage topology and the complete synthetic CLI run pass. Independent review exposed timestamp, identity, product binding, projection and concurrency defects; corrected paths now have deterministic regressions, including a resumed stale process after lease expiry. See VERIFICATION.md for the evidence boundary.

## Status boundaries

- Built: executable measurement, targeting, report planning and guarded transport.
- Live business data: not supplied; fixture metrics remain synthetic.
- Control Center protocol client (2026-10-19): built and tested against a local stand-in; the daily dispatch workflow is in place. Its first live run succeeded on 2026-10-19 and the daily dispatch ran every day until Krish held the engine on 2026-10-29; the last live run was that morning's (update, 2026-11-12; `docs/history/LOG.md`). Control Center's attribution allowlist still omits Legibility; the buyer has arrived in the 1.13.0 directive since control-center PR 588 deployed on 28 October.
- Live measurement: since 27 October a dispatch run reads the app's export and measures `weekly_builders`; what it still lacks is in OPERATIONS.md, "What a dispatch measures today".
- App testbench, email verification/report saving, referral and event exporter: app-owned activation prerequisites; not changed here.
- External sends/posts, paid services, production mutation and deployment: not activated. The only recurring run is Control Center's daily dispatch, which reports and holds, and it has sent none since Krish held the engine on 29 October. CI's `fold` job (below) writes NOW.md on a push to main, never on a clock.
- Growth impact and March 2027 ambition: unproven; measured only after real use and independently reconciled sources.
- Copy doctrine (2026-10-19): the Copywriting, Offers and Demand Corpus and its summary are preserved byte-for-byte in _corpus and verified by check and doctor; docs/COPY-DOCTRINE.md applies it to builder drafts. Built and tested locally, then merged as 9feded1 (PR 3). It is guidance only: no draft, policy, contract or protocol behaviour changed, and no draft written under it has been sent or measured.

- Reader Check (2026-11-10, Ruling, Krish): built and tested, 7 tests in tests/reader.test.mjs. `npm run reader` writes one brief per candidate draft for fresh sub-agents in a Claude session, reads their answers by fixed rules, tallies by impact angle and keeps a private ledger with no words; `calibrate` scores it against a typed outcomes file. In shadow: nothing is held, proposed or counted. Proved end to end on the synthetic fixture invitation with one real sub-agent (answer in shape, tally in codes, ledger with no words; about 137,000 sub-agent tokens for that reader). Not run on a live invitation; its standing is `too_early`, and the ledger lives in the runtime/ of the machine that runs it.

- Held (2026-10-29, Ruling, Krish): built and tested in tests/hold.test.mjs. `config/activation.json` ships held, and Control Center has held the engine since that day: no wake, so no run has exercised it live.
- Prepaid credits, protocol 1.16.0 (2026-10-29): built and tested in tests/credits.test.mjs. The runner reads its share and spends none; the credits session (CREDITS-SESSION.md) waits on the release. No live run has read a credits block yet.
- Krish's instruction and the engine's state, protocol 1.20.0 (2026-11-11, Ruling, Krish): built and tested in tests/engine-state.test.mjs, merged as 46769b7 (PR 26). Not run live: while Control Center holds the engine it sends no wake and its directive carries no instruction. Since 2026-11-12 a next step whose own deadline has passed is left out of `next_steps`.
- Closeout fold (2026-11-12): the `fold` job in `.github/workflows/ci.yml` folds `now-notes/` into NOW.md on every push to main with ai-harness's closeout hook (OPERATIONS.md, "Closeout notes"). Proved by the first merge that carries a note.

See CONTROL-CENTER-BRIEF.md for the protocol this engine now follows; CONTROL-CENTER-HANDOFF.md is kept for history.
