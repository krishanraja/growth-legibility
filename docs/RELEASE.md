# Producer release 1.0.0

Built 18 October 2026 for the explicitly requested growth-legibility repository.

## Verified locally

The release is accepted only after check, all focused/integration tests, conveyor topology validation and the full synthetic CLI demonstration pass. Tests exercise actual loopback HTTP receiver persistence and independent readback, ambiguous-response recovery and restart-persistent retry limits. Corpus bytes are compared to the supplied attachment and the manifest.

All 54 local tests pass. Syntax, policy, snapshot, privacy scan, original corpus integrity, five-stage topology and the complete synthetic CLI run pass. Independent review exposed timestamp, identity, product binding, projection and concurrency defects; corrected paths now have deterministic regressions, including a resumed stale process after lease expiry. See VERIFICATION.md for the evidence boundary.

## Status boundaries

- Built: executable measurement, targeting, report planning and guarded transport.
- Live business data: not supplied; fixture metrics remain synthetic.
- Control Center receiver, dashboard projection and attribution allowlist: proposed handoff, not implemented in this repository.
- App testbench, email verification/report saving, referral and event exporter: app-owned activation prerequisites; not changed here.
- Recurring campaign, external sends/posts, paid services, production mutation and deployment: not activated.
- Growth impact and March 2027 ambition: unproven; measured only after real use and independently reconciled sources.

See CONTROL-CENTER-HANDOFF.md for the exact next implementation and acceptance boundary.
