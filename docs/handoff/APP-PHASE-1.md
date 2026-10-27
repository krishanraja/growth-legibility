# Legibility app, Phase 1: the app contract A1 to A8

**For:** a session working in the Legibility app repository (`krishanraja/legibility`).
**From:** the Legibility growth engine (`krishanraja/growth-legibility`, public), written 27 October 2026.
**Status:** a proposal for the app's owner. Nothing in it is built, deployed or approved yet. Every deploy needs Krish's yes for that deploy.

This brief is self-contained: everything needed to build A1 to A8 is below, so do not ask Krish to repeat the brief. Where it cites this engine's files, they are public at `https://github.com/krishanraja/growth-legibility`, and reading them is optional. The plan behind it is [ENGINE-ARCHITECTURE.md](../ENGINE-ARCHITECTURE.md), section 11, Phase 1, part 1A.

The app repository's own rules outrank this brief on app matters (structure, tests, deploy steps). This brief outranks nothing there; it says what the engine needs and why.

## 1. Start here

1. Read the app repository's own AGENTS.md (or CLAUDE.md) and its North Star, and say which part of it each item moves.
2. Read section 2 (what binds every item) and section 3 (order).
3. Do section 11 (the source review read) first: it is read-only, takes minutes, and the engine has a hard deadline on it (10 November).
4. Build one item per pull request, in the order of section 3. Each pull request carries its own acceptance tests, written before the code.
5. Stop at each deploy and ask Krish, once, for that deploy only.

## 2. What binds every item

### The number this serves

Legibility's North Star number is **builders making trusted reads every week**: 300 by 28 December 2026, on a front-loaded weekly ladder (1 in the week of 26 October, 5 in the week of 2 November, 19 by 16 November, 135 by 14 December, 300 by 28 December). Its source is "weekly active keys with a trusted read, excluding Krish's own". Today it is unmeasured, which counts as urgency U4. The growth engine reports three campaign objectives beside it: `activated` (builders with a first trusted read, target 75), `returning` (mature seven-day returning builders, target 30) and `net` (qualified Founding 200 enrolments, target 200).

The product North Star (the app's own) is: by March 2027, more of Legibility's revenue comes from agents paying per call in USDC on mainnet than from human sign-ups, and a hundred production agents depend on it every week. The engine's part of it: by March 2027, trace every production agent to the channel that earned it.

### Why the app work is the critical path

Measured on 27 October:
- every daily engine report is held with `source_snapshot_missing`: there is no export from the app, so 0 of 11 runs measured anything;
- there is no internal-key flag, and `northstar_weekly` counts accounts and excludes nobody;
- nothing captures where a builder came from, and x402 calls write no row;
- there is no developer waitlist page and no trial entitlement;
- the public MCP manifest carries a consumer email address.

### The trial investigation (27 October, read-only, at the app's `ffe7cda`, checked by two adversarial verifiers)

- **Today there is no trial.** Every account is on the Free plan: 1,000 trusted reads a calendar month, 60 calls a minute, no card, a hard stop, and a cost fuse (default 3,000 cents).
- **The honest offer needs no code today.** "A 30-day free trial in exchange for feedback" is true on Free as long as it promises at most "up to 1,000 trusted reads a month". It must promise no enforced end date, no unlimited use and no waived charges.
- **The real trial is A8**, the smallest safe design the investigation found (section 10).
- The migration target is the project named in `supabase/config.toml`, never the stale one in `docs-internal/engineering.md`.

### Krish's rulings of 27 October that bind the app

1. **Commercial leaders first, and the engineer they introduce holds the key.** From Wave 1 the engine goes in through commercial leaders at companies that buy product data for their own agents or products (marketplaces, comparison and affiliate sites, procurement platforms, catalogue-enrichment firms, agent startups). The 25-minute call ends with a test report on their own product pages, then an introduction to the engineer who will get the trial key. **The number moves only when that engineer makes a first trusted read from their own key.** For the app this means: the engineer's account and key must trace back to the commercial leader's invitation (A2), and the engine gives no credit to a key that existed before its touch.
2. **One offer, the Founding 200.** A Founding 200 member gets a 30-day free trial in exchange for feedback, plus a test report on their own products. Keep "free" beside the trial. Until A8 is approved and live, every app surface words it as Free allows: up to 1,000 trusted reads a month, no enforced end date, no unlimited use, no waived charges, no price.
3. **No Calendly.** Booking is "reply to book": Krish books the call himself in his Google Calendar, with the invitation id in the event. The app shows no booking link, widget or scheduler anywhere, and never counts bookings or held calls (Control Center reads his calendar for that).
4. **Drafts land in his mindmake.co mailbox.** Outreach drafts are placed by Control Center's Draft press into Krish's mindmake.co mailbox, and Krish presses send. The app never drafts, sends or schedules outreach, follow-ups or reminders to prospects. Its own mail is only fixed transactional mail (a verification link, a key issued, a trial used up), sent from role addresses. **Never write an email address** into code, docs, tests, fixtures, migrations or pull request text: addresses live in environment configuration.
5. **Draft, don't send** (26 October): nothing the engine prepares is sent by software.
6. **Merge each pull request once it is green**, but **each deploy and each migration waits for Krish's yes** for that deploy. A migration is applied before the code that reads it is merged.

### Rules for every item

- **Privacy.** No people, email addresses, names, secrets, keys, project ids or production figures in git, logs, test fixtures or pull request text. Fixtures are synthetic.
- **Unknown stays unknown.** An export section the app cannot vouch for says so (`coverage: false`, or `complete: false`); it never sends an empty list that reads as zero.
- **Browser analytics never feed the export.** GA4 and PostHog are cross-checks. The export reads server-side rows only: reads from server metering, verification and keys from auth, payments from settled records.
- **Copy.** Plain English. No em dashes. Never lead with a price. x402 is testnet (Base Sepolia); never claim mainnet. Never claim coverage beyond what the product reads today (structured pages, Shopify, barcodes).
- **Nothing here authorises** sending, posting, spending, provisioning an account, changing billing, Stripe or a permission, or a deploy without Krish's yes at that moment.

## 3. Order and dates

| Order | Item | Aim | Why first or why then |
|---|---|---|---|
| 1 | **A1** internal list and `northstar_weekly_keys` | 30 Oct | Without it the number counts Krish's own reads |
| 2 | **A2** attribution capture | 31 Oct | Must be live before the first invitation goes out (the engine's first go-live is on a Monday or Thursday); a touch that is not captured can never be credited later |
| 3 | **A4** row-level export | 3 Nov | Ends `source_snapshot_missing`; must be live before the engine's first check-in, and the engine's first live run after it reports the number within 24 hours |
| 4 | **A6** role address in the MCP manifest | 4 Nov | The directory track: Krish publishes and submits by **5 Nov**, after A6 and A7 |
| 5 | **A7** MCP tool titles, `outputSchema`, annotations, `server.json` | 4 Nov | Same: by **5 Nov** |
| 6 | **A3** run-first Founding 200 page | week of 9 Nov | The ladder needs inbound first reads from the week of 16 Nov |
| 7 | **A8** the 30-day trial | week of 9 Nov | A3 issues A8's trial key; the offer becomes enforceable |
| 8 | **A5** log x402 calls | after A8, or with A4 if it is small | Keeps mainnet and testnet apart; until then the export says `settlements: false` |

The aims are planning dates, not rulings. A1, A2 and A4 come first; A6 and A7 must be deployed in time for Krish to submit by 5 November; A3 and A8 come next. If an item slips, say so in its pull request with the new date, and keep the order.

## 4. Shared definitions

- **Trusted read.** A server-metered read through REST (`api`) or MCP (`mcp`) where a product came back, its confidence is at least 0.7, and it carries a calibration version. Testbench reads, dashboard quickstart reads and sample reads never count.
- **ISO week.** Monday 00:00:00 UTC to the next Monday 00:00:00 UTC. 2026 has 53 ISO weeks: the final rung, 28 December 2026, is the Monday that starts ISO week 53.
- **Internal.** Any account on the A1 list, and every key on such an account.
- **Opaque id.** HMAC-SHA-256 of the app's own row id under a secret export key that only the app holds (an environment variable, suggested name `EXPORT_ID_KEY`), written as lowercase hex with a prefix: `acct_`, `key_`, `read_`, `evt_`, `stl_`. Stable across exports, so the same account has the same id every day. Never a database id, email, name, key value or prefix, wallet address or IP. Every id must match `^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$`. Rotating `EXPORT_ID_KEY` breaks returning counts, so rotate it only with Krish's yes.
- **UTC instant.** Exactly `YYYY-MM-DDTHH:MM:SSZ` or `YYYY-MM-DDTHH:MM:SS.sssZ`. Postgres keeps microseconds: truncate to milliseconds, or the engine refuses the row (`invalid_contract:read_identity_date` and the like).
- **Invitation id.** The engine puts one in every link of an invitation as `utm_content`. It begins `legibility:`, is at most 120 characters, and uses only letters, digits, `:`, `.`, `_` and `-`. Treat it as opaque. Every invitation link carries `utm_source`, `utm_medium` (`email`, `linkedin`, or `introduction` for the link that reaches the introduced engineer), `utm_campaign=<wave id>` and `utm_content=<invitation id>`.
- **Channel label.** One short label per account and per event, written to `acquisition_source` and `events[].source`, lowercase and matching `^[a-z0-9][a-z0-9._:-]{0,79}$` (anything else reads as `unattributed` in the engine). Pick the first that applies: `internal`; `introduction` (an invitation id arriving with `utm_medium=introduction`); `invitation` (any other invitation id); `directory:<directory>`; `utm:<utm_source>`; `referrer:<host>`; `direct`.
- **Directory.** One of `mcp_registry`, `claude_directory`, `smithery`, `glama`, `pulsemcp`: recognised by our own listing links (`utm_medium=directory&utm_source=<directory>`) or by a fixed list of referrer hosts in code, one per directory.

## 5. A1: the internal list and `northstar_weekly_keys`

**Why.** The North Star's source excludes Krish's own keys, and today nothing does. With one real account in the app, an unflagged internal key can be the whole number. This serves `weekly_builders` (the number) and every objective the engine reports.

**Behaviour.**
- An internal list kept in the app's database, never in git, covering every internal class: `krish` (every Krish account), `engine` (the growth engine's key), `testbench`, `directory_test` (the account directory reviewers use), `registry` (registry keys), `ci`, `demo` and `smoke` keys.
- Every internal key lives on an internal account. The app refuses to record an internal key on an account that is not internal, so `is_internal` on the account is enough for the export.
- `northstar_weekly_keys(week_start)`: one row per ISO week and key with at least one trusted read that week, internal excluded, with that key's trusted-read count. The number for a week is the count of its rows.
- `northstar_weekly` is replaced with the same signature and the same default argument, now excluding internal accounts. (A8's design also lists this replacement and the `internal_accounts` table; A1 does both first, and A8 then leaves them alone.)
- Membership is added by an admin action at run time, never by a seed file that names anyone.

**Data shape.**
- `internal_accounts`: `account_id` (primary key, references the accounts table), `class` (one of the eight classes), `added_at`, `added_by` (an account id, never an address). Service role only: row-level security on, no policy for anonymous or signed-in roles.
- `internal_keys`: `key_id` (primary key), `class`, `added_at`. Same access rule, plus the check that the key's account is in `internal_accounts`.
- `northstar_weekly_keys(week_start date default <this ISO week's Monday>)` returns `(iso_week text, week_start date, key_id, trusted_reads integer)`. Service role only.

**Acceptance tests.**
1. A fixture with one account per internal class and two external builders, each with trusted reads: the function returns exactly the two external keys.
2. Reads at Sunday 23:59:59.999 UTC and Monday 00:00:00 UTC land in different ISO weeks; a read on 28 December 2026 lands in 2026-W53.
3. A read below 0.7, a read with no product, a read with no calibration version and a testbench read each add nothing.
4. Recording an internal key on an account that is not internal is refused.
5. Anonymous and signed-in roles can neither read the two tables nor call the function.
6. `northstar_weekly` keeps its signature and default, existing callers still work, and its result now excludes internal accounts.
7. No migration, seed or test file contains an email address, a name or a key value.

**Krish approves:** which accounts are internal (the membership, added at run time), the migration, and the deploy.

## 6. A2: attribution capture

**Why.** The engine's March 2027 line is to trace every production agent to the channel that earned it, and Krish's ruling 1 (section 2) needs the introduced engineer's first read to trace to the commercial leader's invitation. The Learning Judge decides which impact angle works per invitation; without the invitation id on the read, nothing can be learned. A touch that is not captured cannot be credited later.

**Behaviour.**
- **Landing.** When a legibility.io page loads with any `utm_*` parameter or a recognised directory referrer, store one first-party touch: the invitation id (from `utm_content`, only when it matches the pattern in section 4), `utm_source`, `utm_medium`, `utm_campaign` (each lowercased, at most 100 characters, matching `^[a-z0-9][a-z0-9._:-]{0,99}$`, otherwise null), the referrer's host only (never its path or query), the directory if any, and the time. Keep it in a first-party cookie for 30 days. Any other `utm_content` value is dropped.
- **Enrolment.** When an account is created, attach the latest touch (or none) to the account as its enrolment touch, and set `acquisition_source` from it (section 4).
- **Key creation.** When a key is created, attach the touch of that session to the key, including for a trial key an introduced engineer receives. Record the first client that uses the key: the MCP `initialize` request's `clientInfo.name`, or for REST the first product token of the User-Agent without its version (for example `curl`), never the full string.
- **The introduced engineer.** The trial link Krish sends after the call carries the same invitation id with `utm_medium=introduction`, so an engineer who opens it in a fresh browser still traces. A8's grant form also takes an optional invitation id, so a key granted by hand traces too.
- **Events alongside PostHog.** Send GA4 `generate_lead` (a Founding 200 or enrolment form submitted), `sign_up` (a verified account created) and `test_run` (a completed run-first test, A3, or a dashboard test), with the same names in PostHog. Parameters: the invitation id and the channel label only, never an email, IP, product input or key. Krish marks them as key events in GA admin once A2 ships; Control Center's daily Google Analytics check (`key_events_configured`) watches for that.
- **Notice.** Follow the app's existing cookie and privacy notice. If it does not cover a first-party attribution cookie, propose the words to Krish as part of this item's approval.

**Data shape.**
- `attribution_touches`: `id`, `account_id` (null before enrolment), `key_id` (null unless a key touch), `kind` (`landing`, `enrolment`, `key_creation`), `invitation_id`, `utm_source`, `utm_medium`, `utm_campaign`, `referrer_host`, `directory`, `client`, `occurred_at`. Service role only.
- How it leaves the app: section 8, the `attribution` object.

**Acceptance tests.**
1. A landing with all four `utm_*` values, then enrolment: the account's enrolment touch carries them, the invitation id is set and `acquisition_source` is `invitation`.
2. A `utm_content` over 120 characters or with a disallowed character gives a null invitation id.
3. A referrer with a path and a query stores the host only.
4. The engineer path: a fresh browser opens an introduction link, enrols and creates a key. The key's touch carries the commercial leader's invitation id and the account's label is `introduction`.
5. A key created before the touch keeps its earlier creation time unchanged, so the engine can refuse the credit.
6. An MCP `initialize` with a client name records that name; a REST call with a full User-Agent records only its first product token.
7. With the network mocked, GA4 and PostHog each receive `generate_lead`, `sign_up` and `test_run` exactly once per action, and no payload carries an email, IP, product input or key.
8. A visit with no parameters and no recognised referrer stores no touch, and the account's label is `direct`.

**Krish approves:** the deploy, any change to the notice, and marking the three key events in GA admin (his action after the deploy).

## 7. A3: the run-first Founding 200 page

**Why.** `net` (qualified Founding 200 enrolments, target 200) and the inbound volume the ladder needs: on the plan's own assumptions, calls alone miss the ladder from 16 November, and reaching 300 needs about 80 inbound first reads a week by early December. A builder must be able to try Legibility in two minutes with no signup.

**Behaviour.**
- A page linked from the home page (suggested path `/founding-200`). **Inputs:** one product URL or barcode, what you are building, REST or MCP, and which stores matter.
- **Before verification:** the result shows inline with no email asked. Per-IP and per-domain limits are stored persistently (in the database, so a restart does not reset them), with a bot challenge and a daily run count and cost ceiling. The only email sent before verification is a fixed-template verification link, with no text the visitor typed in it.
- **After verification:** issue the key (A8's 30-day trial key once A8 is live and Krish chose automatic trials; a Free key until then) and the report, with a pre-filled curl command and MCP config using the builder's own input.
- **Counting.** A Founding 200 entry is qualified only with a verified email, a use case and one real input (that sets `relevant_context: true` in the export). Internal and test entries are excluded. The source is recorded (A2). No bought lists.
- **Non-fit entrants** still get a key and an honest coverage note, but no call is offered.
- Enrolment continues past 200. Show no counter unless it is the real count from the database and Krish approves showing it.
- **Sender:** role addresses only. **No booking link** on the page or in any mail (ruling 3).
- **Words:** the one offer, worded as section 2 says until A8 is live. Plain English, no em dashes, no price first, x402 testnet only.
- Server-side events for the export: `beta_page_viewed`, `testbench_started`, `testbench_completed`, `founding_200_submitted`, `email_verified`, `key_created`.

**Acceptance tests.**
1. A run with no email shows the result inline.
2. The run past the per-IP limit, and the run past the per-domain limit, are refused with a plain message; both limits survive a restart.
3. A run without the bot challenge is refused.
4. At the daily cost ceiling, runs stop with a plain message, and nothing is charged to anyone.
5. The verification email uses the fixed template and contains nothing the visitor typed.
6. After verification the builder sees a key, the report and a curl command with their own input; a non-fit entrant sees the coverage note and no call offer.
7. The page and its mail contain no booking link, no em dash, no mainnet claim and no promise beyond the offer's wording (a test greps the rendered page and the templates).
8. Qualification: an unverified entry exports `email_verified: false`, an entry with no use case exports `use_case: ""`, an entry with no real input exports `relevant_context: false`, and an internal entry exports `is_internal: true`, so the engine counts none of them.

**Krish approves:** the deploy, the page's words, the limits and the ceilings (propose numbers in the pull request), and whether sign-ups get an automatic capped trial or a Free key (an A8 decision).

## 8. A4: the row-level export

**Why.** Every engine report is held with `source_snapshot_missing`, and every objective is `missing`. The export ends that. It is row-level, not aggregate, because the engine composes the full snapshot and runs its own existing capture and measure, so every guard still applies (internal exclusion, testbench exclusion, the 0.7 gate, replays that cannot inflate counts, mature seven-day returns, no credit to a key made before its touch). An aggregate would bypass all of them.

### The route

- `GET https://legibility.io/api/internal/growth/export?start=<UTC instant>&end=<UTC instant>` (path suggested; say the final one in the pull request).
- **Auth:** `Authorization: Bearer <token>`. One token, generated once, stored only as its SHA-256 in the app, good for this route only, revocable. Compare in constant time. 401 with no detail for a missing or wrong token. Krish adds the same value to growth-legibility as an Actions secret (suggested name `LEGIBILITY_EXPORT_TOKEN`). The value never appears in chat, git, logs or a pull request.
- **No redirects:** the route answers directly (the engine pins the origin and refuses a redirect). `Cache-Control: no-store`. JSON. Within 20 seconds.
- **Window:** `start` before `end`, `end` no later than now, at most 92 days. 400 otherwise. The engine asks for the campaign to date plus the trailing seven days.
- **Size:** one response, at most 100,000 rows per section and 20 MB in all. A window over either limit gets 413 `window_too_large`, and the engine narrows it. No pagination is needed at today's scale.

### The body

```json
{
  "export_version": "1.0.0",
  "mode": "live",
  "captured_at": "2026-11-03T05:00:00.000Z",
  "app_revision": "<the deployed commit, full hash>",
  "window": { "start": "2026-09-29T00:00:00Z", "end": "2026-11-03T05:00:00.000Z", "complete": true },
  "coverage": { "accounts": true, "reads": true, "events": true, "settlements": false },
  "reconciliation": { "reads_metered": 0, "reads_exported": 0 },
  "accounts": [ { "id": "acct_<hex>", "email_verified": true, "use_case": "Comparison agent", "relevant_context": true, "is_internal": false, "enrolled_at": "2026-10-28T10:00:00.000Z", "api_key_created_at": "2026-10-28T10:05:00.000Z", "acquisition_source": "invitation", "production_agent": false } ],
  "reads": [ { "id": "read_<hex>", "account_id": "acct_<hex>", "occurred_at": "2026-10-30T11:00:00.000Z", "interface": "api", "product_present": true, "confidence": 0.91, "calibration_version": "<calibration revision>", "cost_usd": 0.001, "method": "jsonld", "failure_reason": null, "session_id": "sess_<hex>" } ],
  "events": [ { "id": "evt_<hex>", "type": "founding_200_submitted", "account_id": "acct_<hex>", "occurred_at": "2026-10-28T09:59:00.000Z", "source": "invitation" } ],
  "settlements": []
}
```

The values above are synthetic. Each row's keys are exactly the engine's contract (`src/guards/wire.mjs`, `validateSnapshot`): **every object is closed**, so an extra key is refused (`invalid_contract:unknown_fields_account`, `..._read` and so on), and the whole snapshot with it.

**`accounts[]`**: every account that exists at `captured_at` (deleted accounts and all their rows are left out).
- `id`: opaque. `canonical_id`: only when the app itself records that two accounts are one builder, pointing at an account in the same export; otherwise leave the key out. Never a guessed match.
- `email_verified`: from auth. `use_case`: what the builder typed for "what you are building", at most 2,000 characters, `""` if nothing. `relevant_context`: true once the builder has supplied one real input (A3).
- `is_internal`: from A1. `enrolled_at`: account creation. `api_key_created_at`: the first key's creation, or null.
- `acquisition_source`: the channel label (section 4), at most 120 characters.
- `production_agent`: true only with deployment evidence the app's owner has reviewed and keeps; otherwise false.

**`reads[]`**: every metered read in `[start, end)`.
- `interface`: `api` or `mcp` for real calls; `testbench` for the testbench, dashboard quickstart and sample reads (so they never count). x402 calls have no account, so they are not reads here (A5).
- `product_present`: a product came back. `confidence`: the overall confidence the 0.7 gate uses, 0 to 1. `calibration_version`: the calibration revision, never empty for a read that could be trusted.
- `cost_usd`: the metered cost, 0 or more. `method`: the extraction method, at most 100 characters. `failure_reason`: null, or a short code (at most 200 characters).
- `session_id`: the MCP session id when there is one, otherwise an opaque hash of the key and the UTC date. The engine counts a builder as returning when a read in a different session lands more than a day after the first.

**`events[]`**: server-side only, `account_id` null before enrolment, `source` the channel label. The engine counts `beta_page_viewed`, `testbench_started`, `testbench_completed`, `email_bounced`, `complaint_reported`, `unsubscribed` and `referral_enrolled`, and ignores types it does not know, so also send `founding_200_submitted`, `email_verified`, `key_created`, `trial_granted` and `trial_ended`. Never an IP, User-Agent, email or product input.

**`settlements[]`**: empty with `coverage.settlements: false` until A5.

**`window.complete` and `coverage`.** True only when every row of that section in the window was read. Metering is best-effort today, so reconcile: compare metered read rows with the counter the entitlement check uses for the same window, put both in `reconciliation`, and set `coverage.reads: false` when they differ.

**Never in the export:** email addresses, names, IPs, product inputs (URLs or barcodes builders typed), key values or prefixes, wallet addresses, full User-Agents, Stripe ids, database ids.

### The A2 fields: built now, sent only when the engine asks

The engine's validator does not accept attribution fields yet: it refuses them today. So build them behind a request parameter, `fields=attribution`, and send them only when the engine asks. The engine will ask once its validator accepts them (a growth-legibility pull request, Phase 1B, which names the fields in its `contracts/README.md`). Without the parameter, the export is exactly the shape above.

With `fields=attribution`, each account gains one closed object, and each read one key:

```json
"attribution": {
  "enrolment": { "invitation_id": "legibility:<opaque>", "utm_source": "outreach", "utm_medium": "email", "utm_campaign": "wave-1", "referrer_host": null, "directory": null, "client": null, "touched_at": "2026-10-28T09:58:00.000Z" },
  "first_key": { "invitation_id": "legibility:<opaque>", "utm_source": "outreach", "utm_medium": "introduction", "utm_campaign": "wave-1", "referrer_host": null, "directory": null, "client": "curl", "touched_at": "2026-10-28T10:04:00.000Z" }
}
```

- `enrolment` and `first_key` are each null or a closed object with exactly those eight keys; every value but `touched_at` may be null.
- `reads[].key_id`: the opaque `key_` id of the key that made the read, so the number can be counted per key (an A8 decision).

### Acceptance tests

1. **The engine's own validator passes.** Vendor `src/guards/wire.mjs` from growth-legibility at a pinned commit (check its SHA-256 against that commit's `contracts/manifest.json`), compose the export into a full snapshot as below, and run `validateSnapshot`. This exact composition was run against the engine's validator and measure stage on 27 October with a synthetic export: it validated, the internal account and the testbench read were excluded, an extra key on an account was refused, and a microsecond timestamp was refused.

   ```js
   import { validateSnapshot } from './vendor/growth-legibility/wire.mjs';
   const snapshot = {
     schema_version: '1.0.0', snapshot_id: `app-export-${e.captured_at}`, mode: e.mode,
     captured_at: e.captured_at, app_revision: e.app_revision, window: e.window,
     coverage: { ...e.coverage, billing: false, partners: false, spend: false, feedback: false, candidates: false, opportunities: false },
     icp: { status: 'missing' }, accounts: e.accounts, reads: e.reads, events: e.events, settlements: e.settlements,
     billing: [], partners: [], spend: { paid_media_usd: 0 }, feedback: [],
     benchmark: { selection_method: 'none', consented: false }, suppressions: [], candidates: [], opportunities: [],
   };
   validateSnapshot(snapshot, e.captured_at);
   ```
2. Two exports of the same window give the same ids.
3. Every internal account (all eight classes) exports `is_internal: true`; a testbench, quickstart or sample read exports `interface: "testbench"`.
4. Every timestamp is a UTC instant with at most millisecond precision.
5. 401 with no token and with a wrong token; 400 for a reversed, future or over-92-day window; 413 over the size limits; never a 3xx.
6. A scan of an export built from a seeded fixture finds no `@`, no IP address, no key value or prefix, and no database id.
7. `coverage.reads` is false when the reconciliation counts differ.
8. With `fields=attribution`: the fields appear exactly as above and validate against the first growth-legibility commit that accepts them; without it, they are absent.

**Krish approves:** the deploy, and generating the token and adding it as the Actions secret (his action).

## 9. A5, A6 and A7

### A5: log x402 calls

**Why.** The product North Star compares mainnet agent revenue with human sign-up revenue; today x402 calls write no row, so neither the app nor the engine can see them. Mainnet and testnet must stay apart.

**Behaviour.** Every x402-paid call writes one row, keyed by its payment id so a retried payment never writes two: `occurred_at`, `network` (`base-sepolia` today; `base-mainnet` only when it is real), `status` (`settled` or `failed`), `payer` (`agent` for an x402 call; `human` only with evidence the app keeps), `amount_usd` (converted with a dated rate the app records). The export then sends `settlements[]` with exactly the keys `id`, `occurred_at`, `network`, `status`, `payer`, `amount_usd`, and `coverage.settlements: true`. x402 reads stay outside the number, and outside "nothing charged" (A8).

**Acceptance tests.** One test call on Base Sepolia writes exactly one row; a retried payment writes no second row; a failed payment writes `failed`; the export carries no wallet address; testnet amounts never appear as mainnet.

**Krish approves:** the deploy.

### A6: a role address in `/.well-known/mcp.json`

**Why.** The public MCP manifest carries a consumer email address. Directory listings (the registry track, by 5 November) need a role address, and the Registry Steward's lint refuses a personal one.

**Behaviour.** Replace the contact with a role address on the legibility.io domain that Krish names. Read it from configuration; do not write it into the brief, tests or pull request text.

**Acceptance tests.** `GET /.well-known/mcp.json` returns 200 and valid JSON; its contact is the configured role address; a test fails if the contact is anything else.

**Krish approves:** which role address, and the deploy.

### A7: MCP tool titles, `outputSchema`, annotations and `server.json`

**Why.** The same directory track. The reviewer's question is: "Would a reviewer find any tool description that overstates what it does?"

**Behaviour.**
- Each tool gets a plain `title`, an `outputSchema` that matches what it really returns, and returns `structuredContent` beside its text.
- Annotations: `readOnlyHint: true` and `destructiveHint: false` for read tools, `idempotentHint` only where it is true, `openWorldHint: true` for tools that read the web.
- Descriptions state the real scope: structured pages, Shopify and barcodes; the 0.7 trust gate; an honest null when it is not safe; x402 on testnet. No "any website", "all stores", "guaranteed" or "mainnet".
- `server.json` for the official MCP Registry, valid against the registry's published schema (name the schema version in the pull request), with the remote URL and version.

**Acceptance tests.** Each tool, called on fixtures, returns `structuredContent` that validates against its `outputSchema`; `tools/list` shows every title and annotation; `server.json` validates; a lint over the descriptions fails on the overclaiming words above.

**Krish approves:** the deploy. Publishing `server.json` and submitting the directory listings are Krish's own actions, by 5 November. The listing texts (Smithery, Glama, the Claude directory packet) are prepared by the growth engine, so the A7 pull request names the exact server name, version and remote URL it shipped.

## 10. A8: the 30-day trial

**Why.** The offer (ruling 2) is a 30-day free trial; today the honest version is Free's 1,000 trusted reads a month with no end date. A8 makes the trial real and enforceable, and gives the introduced engineer a trial key that traces to the invitation.

**Behaviour** (the investigation's smallest safe design):
- **Data model.** One additive migration adds `trial_grants` (one row per account, at most 30 days) and `grant_trial()`, and replaces `entitlement_check` with the same signature. (The design also lists `internal_accounts` and a `northstar_weekly` replacement; if A1 has shipped them, A8 leaves them alone, and keeps `northstar_weekly`'s default argument if it touches it at all.)
- **Precedence.** A real (non-free) Stripe subscription wins. Otherwise a live grant counts reads since its `starts_at`, with a hard stop at its allowance. Otherwise the account is on Free as today. An exhausted or ended trial falls back to Free, so a trial is never worse than Free.
- **What it never touches:** Stripe, `subscriptions`, checkout and `rate_check`.
- **Grants are manual.** Krish's own click on `/dashboard/waitlist`, Trials tab (add the tab if it is not there). That click is the provisioning approval. The engine only proposes a grant. The grant form takes an optional invitation id, so the engineer's key traces (A2).
- **Messages.** The 402 messages say the trial is used up and that nothing was charged.
- **Safeguards from the verifiers:**
  - the cost fuse is sized from the allowance, after an approved read-only measurement of `cost_usd` per call (the 3,000-cent default would stop a 5,000-read trial early);
  - a future overage reporter needs Krish's own approval and never bills reads inside a trial window;
  - x402 stays outside "nothing charged";
  - the migration targets the project named in `supabase/config.toml`, never the stale one in `docs-internal/engineering.md`;
  - the migration is applied before the code that reads it is merged.

**Acceptance tests.**
1. An account with a real paid subscription and a grant is served by the subscription.
2. A live grant counts reads from `starts_at`; the read past the allowance gets 402 with the "used up, nothing charged" words.
3. For any sequence of reads, a granted account is allowed whenever the same account with no grant would be (never worse than Free); after day 30 or exhaustion it is on Free.
4. A grant longer than 30 days, and a second grant for the same account, are refused.
5. Only the service role, through Krish's dashboard action, can call `grant_trial()`.
6. A trial of the approved allowance at the measured cost per call is not stopped early by the fuse.
7. No Stripe call is made (a spy is called 0 times), and `subscriptions`, checkout and `rate_check` are unchanged.
8. x402 calls never get the "nothing charged" message.
9. A grant with an invitation id exports that id on the key's touch (A2, A4).

**Krish's decisions, at the A8 approval:**
- the allowance and the fuse (suggested: 5,000 trusted reads);
- whether the clock starts at the grant (recommended);
- day 30: drop to Free (recommended);
- whether Founding 200 sign-ups get an automatic capped trial or a Free key;
- reminders: drafted by the engine for his approval (never sent by the app);
- which accounts are internal (taken at A1; confirm it here);
- whether the number counts per account or per key (the North Star says key; with one key per account the two differ only when a key is rotated);
- an optional `gtin:demo` stamp, so quickstart sample reads stop inflating the count (until then they export as `testbench`);
- the customer-facing wording.

Plus the deploy and the migration, each with his yes.

## 11. The source review read, for the engine (do this first)

The engine pins four app files at revision `f3c6b77965b0c654fe8eac3611d2d2dfe5a2077e`, reviewed on 18 October. Its policy stops every run on 17 November unless they are reviewed against the app's current head, and the engine's sessions cannot read the app repository. The engine needs the read by **10 November**. It is read-only: change nothing.

1. Record the full commit hash of the app's `main` head on the day you read it.
2. For each file below, at that head, say: still at this path (yes or no), and whether it still establishes the claim (holds, or one line on what changed):
   - `README.md`: the official URL, the REST and MCP tools, the 0.7 gate, honest coverage, and x402 testnet scope;
   - `docs/NORTH_STAR.md`: the March 2027 mainnet-agent revenue ambition and 100 weekly production agents;
   - `docs/KILL-CRITERIA.md`: trusted reads per active account; the trust-rate alert versus the deliberate eight-week thesis review;
   - `src/routes/api/v1/read_product.ts`: key auth, entitlement and rate checks, server metering, and that metering is best-effort.
3. Also say whether these still hold at head: the Free plan (1,000 trusted reads a calendar month, 60 calls a minute, a hard stop, a cost fuse), no trial entitlement, and x402 writing no row.
4. Put the answer in the A1 pull request description: the hash, one line per file, no names, figures or secrets. A growth-legibility session then updates its register from it.

## 12. What comes back to the engine

In each pull request description, never in a secret:
- the item, its deployed commit, and the date Krish approved the deploy;
- A4: the final route path, the export version, the secret's name (never its value), and the growth-legibility commit whose `wire.mjs` the tests vendored;
- A7: the server name, version and remote URL;
- the section 11 answer (in A1).

Krish carries the export token to growth-legibility's Actions secrets himself. The engine side (the export client, the attribution fields in its validator, the source register) is built in growth-legibility, never in the app.

## 13. Not in this brief

- Anything that sends, posts, spends, provisions an account, changes billing, Stripe or a permission, or deploys without Krish's yes for that deploy.
- Outreach, drafting, booking or calendar writes: those belong to Control Center and Krish.
- The buyer definition (ICP): Krish sets it in Control Center, Growth > Buyers.
- The retailer and brand pool: a later wave with its own wording, never mixed into this one.
