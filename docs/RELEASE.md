# Producer release 1.0.0

Built 18 October 2026 for the explicitly requested growth-legibility repository.

## Verified locally

The release is accepted only after check, all focused/integration tests, conveyor topology validation and the full synthetic CLI demonstration pass. Tests exercise actual loopback HTTP receiver persistence and independent readback, ambiguous-response recovery and restart-persistent retry limits. Corpus bytes are compared to the supplied attachment and the manifest.

All 75 local tests passed at this release (54 at the first release, 17 added with the Control Center protocol on 2026-10-19, 4 added with the copywriting corpus on 2026-10-19). Later suites are counted by `npm test`, not written here. Syntax, policy, snapshot, privacy scan, original corpus integrity, six-stage topology and the complete synthetic CLI run pass. Independent review exposed timestamp, identity, product binding, projection and concurrency defects; corrected paths now have deterministic regressions, including a resumed stale process after lease expiry. See VERIFICATION.md for the evidence boundary.

## Status boundaries

- Built: executable measurement, targeting, report planning and guarded transport.
- Live business data: not supplied; fixture metrics remain synthetic.
- Control Center protocol client (2026-10-19): built and tested against a local stand-in; the daily dispatch workflow is in place. Its first live run succeeded on 2026-10-19 and the daily dispatch has run since (update, 2026-10-27; `docs/history/LOG.md`). Control Center's attribution allowlist still omits Legibility; the buyer arrives in the 1.13.0 directive once control-center PR 588 deploys.
- Live measurement: since 27 October a dispatch run reads the app's export and measures `weekly_builders`; what it still lacks is in OPERATIONS.md, "What a dispatch measures today".
- App testbench, email verification/report saving, referral and event exporter: app-owned activation prerequisites; not changed here.
- External sends/posts, paid services, production mutation and deployment: not activated. The only recurring run is Control Center's daily dispatch, which reports and holds.
- Growth impact and March 2027 ambition: unproven; measured only after real use and independently reconciled sources.
- Copy doctrine (2026-10-19): the Copywriting, Offers and Demand Corpus and its summary are preserved byte-for-byte in _corpus and verified by check and doctor; docs/COPY-DOCTRINE.md applies it to builder drafts. Built and tested locally, then merged as 9feded1 (PR 3). It is guidance only: no draft, policy, contract or protocol behaviour changed, and no draft written under it has been sent or measured.

See CONTROL-CENTER-BRIEF.md for the protocol this engine now follows; CONTROL-CENTER-HANDOFF.md is kept for history.
