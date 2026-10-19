# Producer release 1.0.0

Built 18 October 2026 for the explicitly requested growth-legibility repository.

## Verified locally

The release is accepted only after check, all focused/integration tests, conveyor topology validation and the full synthetic CLI demonstration pass. Tests exercise actual loopback HTTP receiver persistence and independent readback, ambiguous-response recovery and restart-persistent retry limits. Corpus bytes are compared to the supplied attachment and the manifest.

All 75 local tests pass (54 at the first release, 17 added with the Control Center protocol on 2026-10-19, 4 added with the copywriting corpus on 2026-10-19). Syntax, policy, snapshot, privacy scan, original corpus integrity, six-stage topology and the complete synthetic CLI run pass. Independent review exposed timestamp, identity, product binding, projection and concurrency defects; corrected paths now have deterministic regressions, including a resumed stale process after lease expiry. See VERIFICATION.md for the evidence boundary.

## Status boundaries

- Built: executable measurement, targeting, report planning and guarded transport.
- Live business data: not supplied; fixture metrics remain synthetic.
- Control Center protocol client (2026-10-19): built and tested against a local stand-in; the daily dispatch workflow is in place. Its first live run, and Control Center's attribution allowlist and product_icp read path, are not verified from this repository.
- Live measurement: a dispatch run reports held until the app's source snapshot and the canonical ICP reach the runner and the campaign clock is activated.
- App testbench, email verification/report saving, referral and event exporter: app-owned activation prerequisites; not changed here.
- External sends/posts, paid services, production mutation and deployment: not activated. The only recurring run is Control Center's daily dispatch, which reports and holds.
- Growth impact and March 2027 ambition: unproven; measured only after real use and independently reconciled sources.
- Copy doctrine (2026-10-19): the Copywriting, Offers and Demand Corpus and its summary are preserved byte-for-byte in _corpus and verified by check and doctor; docs/COPY-DOCTRINE.md applies it to builder drafts. Built and tested locally and pushed to a branch; not merged or deployed. It is guidance only: no draft, policy, contract or protocol behaviour changed, and no draft written under it has been sent or measured.

See CONTROL-CENTER-BRIEF.md for the protocol this engine now follows; CONTROL-CENTER-HANDOFF.md is kept for history.
