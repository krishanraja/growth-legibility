# Beta outreach handoff

Recorded 27 October 2026. This is a sanitised continuation guide for the work completed in the 20-21 October session, with a fresh queue metadata check on 27 October. Private operational truth remains in Control Center. This document is not a second CRM or an assertion that the campaign has launched.

## Decisions Krish made

- Move quickly with people whose needs the product already meets. Small product changes are acceptable when they help win real users.
- Include prospects outside the existing network. Distinguish customer prospects from people asked for a warm introduction. Use a named person at each company.
- Use the approved [outreach template](OUTREACH-TEMPLATE.md). Introduce Krish and Legibility, explain what it does in plain English, explain additive use or conditional replacement of page extraction, state the intended benefit and pilot measurements, and offer a **30-day free trial in exchange for feedback**.
- Demo results support the explanation. Krish rejected an earlier draft that opened with product prices without explaining the sender, business or usefulness. Do not repeat that opening.
- Tailor every note to verified company context and the actual contact channel. Known introducers need a warm introduction request, not a customer pitch.
- Prepare drafts and onboarding in Control Center. Nothing in this work authorised sending, scheduling, billing changes or account provisioning.

## Completed and where to find it

In Control Center, open Home > Waiting on you at https://controlcenter.krishraja.com/#/home?waiting=1 and filter for Legibility. The exact private wording and source evidence belong there, not in this public repository.

| Artifact | Completed state |
|---|---|
| Customer outreach | Five individually researched, named customer drafts with the clear explanation and 30-day free beta offer. Three reserve company pitches and two first-wave pitches. |
| Warm introductions | Two requests to people Krish knows well, asking for one relevant shopping/comparison-agent builder introduction. These are not qualified customer prospects. |
| Contact routes | Four addressed email compose links and three copyable LinkedIn notes across the seven outreach items. Shared inboxes, old published addresses and messaging-access caveats remain visible in their private records. A compose link is not a saved native Gmail draft. |
| Measured demos | Two three-product packs beside the two first-wave drafts. Actual public API results, timestamps, selected-SKU caveats, costs and historical observations retained privately. |
| Onboarding | One reusable pending item titled **Beta onboarding: 30-day free trial**. Contains signup, access confirmation, key creation, first-call examples, response interpretation, errors, feedback checkpoints and an internal activation checklist. |
| Reusable copy | OUTREACH-TEMPLATE.md captures the approved structure without private recipients or production snapshots. |

Drafts, evidence links and compose payloads were independently read back after writes. No message was sent by this session. This is preparation, not customer activation, integration, revenue or measured savings.

## Freshness check on 27 October

Read-only queue metadata check: all seven outreach rows still have state `pending`, with no decision or completion timestamp. Their `expires_at` is **23 October 2026 at 12:45 UTC**, already past. Do not describe them as currently approved or sendable without refreshing contact/company evidence, suppression/contact history and expiry through the normal approval path. Do not silently extend expiry or infer authority from the pending state.

The onboarding item is pending with no expiry. It still requires recipient personalisation and per-account activation checks. No fresh product calls, account provisioning, trial enforcement test or North Star measurement were performed on 27 October.

Private lookup route: Control Center's `growth_engine_proposals`, scoped to `engine_id = 'growth-legibility'`. Outreach proposal IDs begin `legibility:first-users:2026-10-21:`; onboarding proposal ID is `legibility:beta-onboarding:2026-10-21`. Read current values and amendments before any mutation. Do not export rows into Git, public Actions artifacts or PR descriptions.

## Product evidence and limits

The six original demo calls returned trusted products. One stock observation was wrong because a Shopify payload omitted its availability boolean. The worker now checks the matching variant's explicit boolean, leaves unverifiable availability unknown, and refreshes affected legacy cache observations. A fresh public API read, merchant comparison, unavailable-size regression and warm-cache replay passed. The older incorrect observation stays labelled historical in the private demo.

Worker changes are already merged in the separate repository: [availability fix #3](https://github.com/krishanraja/legibility-worker/pull/3) and [cache refresh #4](https://github.com/krishanraja/legibility-worker/pull/4), final source `3d15c4d8ffc1b449689c4abb8f4fbd218ff43410`. At the time, production readiness at that source, 12 deterministic tests and TypeScript checks were verified. This is historical evidence, not a fresh production check on 27 October.

Preserve these boundaries: selected-SKU stock does not describe every variant; extraction methods on one merchant page are not independent stores; confidence 1.0 does not guarantee every field; empty attributes do not prove suitability or compatibility; observed prices are not checkout guarantees. Cost stamps are metering evidence, not invoices. Internal demo calls never count as customer activation.

The temporary encrypted credential used for the bounded demo checks was removed and deletion verified. No credential is preserved here. Obtain scoped runtime access only if a future authenticated check actually needs it.

## Onboarding and the trial gap

The 21 October live quickstart documented `POST https://legibility.io/api/v1/read_product`, bearer API-key authentication, JSON containing either `gtin` or `url`, and dashboard key creation. Signup used an email magic link. URL reads were labelled private beta. An older API reference showed a shorter path and a different response illustration; the private onboarding note uses the quickstart path, corroborated by the earlier real demo calls. Recheck live docs before reuse.

Onboarding sequence already drafted:

1. Tester creates/signs into their account and replies with signup email and three representative public product URLs, never their API key.
2. Owner confirms private-beta URL access, included usage, exact 30-day dates and free trial scope before activation. Tester does not need a paid upgrade to request access.
3. Tester creates a dashboard key, stores it privately, makes the documented barcode call, then tests their own supported URL with the same endpoint.
4. Treat `product: null` as a miss even with HTTP 200. Preserve failures as feedback. Check 401 authentication; pause on 402 to check allowance; honour `retry-after` on 429.
5. Compare actual selected-product fields, source timestamps, coverage, accuracy, latency, cost and integration work with the tester's existing source. Request feedback after first calls, around midpoint and before trial end. Redact keys and private customer data.

**Not implemented or verified:** a dedicated 30-day trial entitlement, beta-access toggle, account-specific allowance, trial clock, enforcement/expiry, reminders or billing handling. The public Free plan's calendar-month quota is not proof of a dedicated 30-day trial. Do not promise unlimited usage, automatic expiry, free overages, waived charges or an SLA. No tester was provisioned by this session.

## Next session

1. Read AGENTS.md, docs/NORTH_STAR.md, NOW.md and this handoff. The current North Star is weekly real builders making trusted reads, with the weekly ladder in NORTH_STAR.md. The number remains unmeasured here, not zero.
2. Read current Control Center directives, decisions, canonical ICP, outreach rows and contact history. Refresh expired outreach before proposing a send; preserve reserve priorities and recipient/channel caveats. Do not rebuild completed copy or ask Krish to repeat the brief.
3. The next recommended product task is to inspect the Legibility app's access/quota/billing implementation and establish a concrete way to provision and enforce the promised free trial. It was suggested but not authorised or implemented in this session. Get the appropriate implementation/release authority before changing access or billing.
4. Once a real tester accepts, personalise the saved onboarding item, verify access and free usage, record dates, and measure their first trusted API read and return. Count only genuine external builder use.
5. Keep the existing GET-GOING engine build checklist separate. This handoff does not complete snapshot-export, ICP-read, autonomy-loop or campaign-clock implementation steps.

## Handoff validation

On 27 October, `npm run check`, all 76 tests, `npm run conveyor`, `npm run demo` and `git diff --check` passed. The demo used synthetic fixtures only; it is not evidence of live adoption or trial provisioning. The queue metadata check was read-only. No engine implementation or North Star target was changed by this documentation update.
