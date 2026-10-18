# Legibility: The Founding 200 Growth Playbook

**Objective:** Acquire more than 200 verified, relevant beta users in 30 days with $0 paid media spend  
**Campaign window:** 19 October to 18 November 2026  
**Operating model:** Autonomous research, targeting, drafting, measurement and optimisation; Krish provides direction and approves every send or publication  
**Primary company:** Mindmake  
**Product:** Legibility  
**Canonical URL:** <https://legibility.io>  
**Repository:** <https://github.com/krishanraja/legibility>

---

## Executive decision

Legibility should not run a generic waitlist campaign.

It should launch a **Founding 200 Builders programme** around a working, free **Product Legibility Testbench**. A developer supplies up to five product URLs, barcodes or product names. Legibility returns a private compatibility report showing what resolved, what could be trusted, what failed, why it failed and what each successful read cost.

The report is the acquisition mechanism. The user experiences the product's central promise before being asked to enrol.

The campaign should combine five motions:

1. Evidence-rich invitations to relevant people in Krish's network.
2. Warm introductions to high-fit builders outside the immediate network.
3. Distribution through developer communities, investors, accelerators and agent-platform multipliers.
4. A public Agent Product Data Benchmark that continually creates outreach and editorial reasons.
5. Agent-native discovery through MCP and x402 directories.

The gross target is **225 verified enrolments**, providing a buffer for duplicates, invalid addresses and people who prove irrelevant. The campaign succeeds only if at least 200 remain after quality control.

### Month-one scorecard

| Outcome | Target |
|---|---:|
| Verified, qualified beta enrolments | 225 gross; 200 net |
| API keys created | 120 |
| Users completing a first trusted read | 75 |
| Users returning within seven days | 30 |
| Structured feedback or outcome reports | 15 |
| Active distribution partners | 5 |
| Paid media spend | $0 |
| Krish's operating time | Under 60 minutes per week |

A name and email alone do not count as a user. A counted enrolment must have a verified address, declared use case and at least one relevant input, intended integration or referral context.

---

## 1. Product truth

### 1.1 What Legibility is

Legibility is trusted product-data infrastructure for software agents and applications.

It accepts:

- A product URL
- A GTIN or barcode
- A fuzzy product name
- Two to five product URLs for comparison

It can return:

- A typed product object
- Confidence for individual fields
- An overall calibrated confidence value
- A price band rather than false point precision
- Currency, date and number of price sources
- The extraction or resolution method
- A stable opaque `legibility_id`
- The calibration version
- The cost of the call

The same underlying capability is available through REST and MCP. API-key billing is live. The x402 path is implemented on Base Sepolia and should be presented as testnet infrastructure, not as proven mainnet commerce.

Source: [Legibility README](https://github.com/krishanraja/legibility/blob/main/README.md).

### 1.2 Current tools

| Tool | Input | Job |
|---|---|---|
| `read_product` | URL or GTIN | Return a typed product result |
| `resolve_product` | Product name | Resolve a fuzzy name and extract the best match |
| `compare_products` | Two to five URLs | Return a side-by-side product matrix and price difference |
| `brief_product` | URL, GTIN or name | Return a product object and short agent-readable brief |

### 1.3 The trust model

A read is billable only when it returns a product at or above the 0.7 confidence gate. Null and below-gate reads consume no trusted-read quota.

This is not incidental billing detail. It is the clearest expression of the product philosophy:

> Legibility charges for an answer it is willing to stand behind, not for an attempt.

### 1.4 Honest coverage

Trusted coverage today is strongest for:

- Browser-accessible `schema.org/Product` JSON-LD
- Shopify storefronts
- GTIN and barcode identity
- Verified OpenGraph product pages

Known constraints include:

- Bot-hostile retailers can block the datacentre IP.
- Apple, Nike, Lego and similar sites must not be used as proof of universal coverage.
- The Bright Data fallback exists but remains dormant pending commercial activation.
- Name resolution depends on available Exa credit.
- x402 is a testnet capability.
- Paid overage reporting and webhooks must not be sold as live capabilities.

The campaign must say this plainly. The ability to return a trustworthy null is part of the product, not a blemish to conceal.

### 1.5 The homepage mismatch

The public homepage currently leads with a commercial question: **Can a machine read your website?** Its main interaction checks a domain, returns a verdict, then offers to email the result. The repository comments deliberately identify the page as written for a commercial buyer rather than a developer.

The API product's clearest initial ICP is different: developers building agentic buying, procurement, comparison and commerce infrastructure.

Do not force both audiences through one promise. Keep the domain-readability page and create a dedicated acquisition surface at `/builders-beta` for the Founding 200 campaign.

Source: [homepage source](https://github.com/krishanraja/legibility/blob/main/src/routes/index.tsx).

---

## 2. Who it is for

### 2.1 Primary ICP

**Developers building agentic buying, procurement and product-comparison experiences.**

Typical characteristics:

- One to twenty engineers
- Shipping or prototyping a product now
- Already evaluating scraping, browsing, search or extraction infrastructure
- Need to know whether extracted facts are safe enough for an agent to use
- Prefer an API or MCP tool to a static data export
- Care about cost per successful result
- Need to reconcile identity, attributes and price observations across sources

Example use cases:

- “Buy this for me” agents
- Procurement copilots
- Product-comparison agents
- Shopping research assistants
- Price-monitoring workflows
- Affiliate product enrichment
- Marketplace catalogue enrichment
- Product research inside coding agents

### 2.2 Secondary ICP

**Commerce-infrastructure teams**, including:

- Marketplaces
- Affiliate networks
- Comparison services
- Catalogue-enrichment systems
- Shopping assistants
- Procurement platforms
- Retail analytics tools

### 2.3 Distribution ICP

**Organisations able to reach relevant builders**, including:

- Agent-development communities
- AI engineering newsletters
- MCP clients and directories
- Developer-relations teams
- Accelerator and venture platform teams
- Commerce developer communities
- Boutique AI engineering firms
- Product-data and scraping consultancies
- Open-source maintainers with adjacent tooling

A multiplier does not need to become a customer. Its job is to put the testbench in front of multiple qualified builders.

### 2.4 Anti-ICP

Do not optimise for:

- Consumers looking for a shopping comparison site
- Brands wanting a full SEO or GEO consultancy
- Teams whose only required sources are known bot-hostile retailers
- Enterprises requiring an SLA, webhooks or procurement support immediately
- People attracted only by crypto or x402 speculation
- Generic AI-tool collectors with no product-data use case

### 2.5 Qualification questions

Ask no more than necessary:

1. What are you building?
2. Do you need REST, MCP or both?
3. Which stores or product sources matter?
4. How do you decide whether extracted data is trustworthy today?
5. What is one real URL, barcode or name you need to resolve?

Source: [Legibility internal sales guide](https://github.com/krishanraja/legibility/blob/main/docs-internal/sales.md).

---

## 3. Positioning

### 3.1 Category

**Confidence-aware product data for agents.**

Do not call Legibility merely:

- A scraper
- A shopping API
- An AI visibility checker
- An MCP server
- An x402 product

Those are implementation details or partial surfaces. The category promise is that an agent can obtain a product object and decide whether it is safe to act on.

### 3.2 Core message

> **Product data your agent can decide whether to trust.**
>
> Give Legibility a product URL, barcode or name. Get a typed product object, confidence for each field, a price range, the source method and the cost in one call.

### 3.3 Positioning hierarchy

1. **Trust:** Product facts with calibrated confidence.
2. **Agent usability:** One typed schema over REST and MCP.
3. **Economic legibility:** Cost stamped into every result.
4. **Honest failure:** Unsafe results are rejected rather than dressed up as facts.
5. **Autonomous commerce:** x402 creates a future path for agents to discover and pay for the capability.

### 3.4 Messages by audience

| Audience | Lead | Proof |
|---|---|---|
| Agent developer | Stop making your agent guess product facts | Typed schema and field confidence |
| Commerce platform | Add product enrichment without owning the full extraction stack | URL, GTIN and name resolution |
| Technical founder | Know whether a result is safe before an agent acts | Calibrated trust gate |
| Agent platform | Add a discoverable product-data capability | Remote MCP server |
| Commercial website owner | See what machines can reliably read | Existing domain checker |

### 3.5 Objection handling

#### “Diffbot already does this.”

Acknowledge the overlap. Then focus on Legibility's combination of per-field calibrated confidence, response-level cost, MCP access, x402 experimentation and confidence-gated billing.

#### “We can use Firecrawl and a model.”

Agree. The alternative means owning schema design, cache behaviour, product validation, barcode reconciliation, calibration, price-band semantics, MCP exposure and payment logic. Legibility packages those decisions behind one call.

#### “Does it work on every retailer?”

No. Explain current trusted coverage before a test. Invite them to run the five inputs that actually matter.

#### “Why trust the confidence?”

Explain the held-out calibration process, identify the current sample and version, and state its limits. Never turn one evaluation into an eternal performance claim.

#### “Why x402?”

Treat it as optional. Card and API-key access are the practical default. x402 shows how an agent could eventually discover and pay for the tool without human account creation.

---

## 4. Campaign architecture

### 4.1 Campaign name

# The Founding 200 Builders

This is a time-bounded research and access cohort, not a manufactured queue for software that is already live.

### 4.2 Exchange of value

Members receive:

- Immediate free access under the existing allowance
- A five-product compatibility report
- A saved history of their submitted tests
- Access to aggregate benchmark findings
- The ability to submit high-value coverage cases
- Early integration recipes
- A chance to influence prioritisation
- Recognition as a contributor only with explicit permission

Legibility receives:

- Qualified developer identities
- Real product sources
- Coverage and failure evidence
- Integration intentions
- Activation and return signals
- Potential partners and customers

### 4.3 Acquisition loop

1. A builder encounters a relevant finding, invitation, partner post or directory listing.
2. They open the Product Legibility Testbench.
3. They test up to five real inputs.
4. The testbench returns trusted, untrusted and unresolved results separately.
5. Email is requested only to save and receive the full private report.
6. Verification enrols the builder and unlocks an API key.
7. The first-call recipe uses one of their original inputs.
8. The builder can invite a collaborator or contribute an anonymised case.
9. Aggregate results improve the public benchmark.
10. The benchmark creates more content, outreach and distribution opportunities.

### 4.4 Channel target model

| Motion | Net user target | Role |
|---|---:|---|
| Evidence-rich direct invitations | 35 | High intent and feedback |
| Multiplier and partner distribution | 60 | Reach without founder social |
| Benchmark-triggered outreach | 35 | Cold or warm, but highly specific |
| Developer communities and launches | 35 | Concentrated discovery |
| MCP and x402 discovery | 15 | Agent-native and durable discovery |
| Member referrals | 20 | Compounding distribution |
| **Total** | **200** | Portfolio rather than one-shot launch |

The gross target is 225. No channel should carry more than 30% of the goal.

### 4.5 Working funnel

| Stage | Month-one target |
|---|---:|
| Relevant visitors | 1,200 |
| Testbench starts | 480 |
| Completed reports | 330 |
| Verified enrolments | 225 |
| API keys | 120 |
| First trusted reads | 75 |
| Seven-day returning users | 30 |

These are planning assumptions, not external benchmarks. Replace them daily with observed rates.

---

## 5. The Product Legibility Testbench

### 5.1 Why it is the centre

The campaign needs a useful object, not a signup form.

The best developer-led growth systems often distribute an asset that solves an adjacent problem before demanding adoption of the commercial infrastructure. Resend's early distribution benefited from React Email, which reached developers with an immediately useful tool closely connected to the paid product. Legibility's corresponding asset should be its testbench and benchmark, not an unrelated open-source project.

Useful case-study context: [Inngest on Resend and React Email](https://www.inngest.com/customers/resend) and [Supabase's Resend customer story](https://supabase.com/customers/resend).

### 5.2 Landing page

Build `/builders-beta`.

#### Hero

> **Product data your agent can decide whether to trust.**
>
> Test five real products. See the typed output, field confidence, price range, source method and cost before integrating.
>
> **[Test five products]**

Secondary action: **Read the API documentation**

#### Proof strip

- URL, barcode or name in
- Typed product object out
- Confidence per field
- Price as a range
- REST and MCP
- Untrusted reads do not consume quota

#### Honesty block

> Legibility works best today on structured product pages, Shopify storefronts and barcodes. Some bot-protected retailers remain outside trusted coverage. The testbench will tell you that rather than guess.

### 5.3 Required behaviour

The testbench should:

1. Accept up to five URLs, GTINs or product names.
2. Detect or ask for the correct input type.
3. Run the corresponding current tool.
4. Display trusted, untrusted and unresolved results separately.
5. Explain why a result did not pass the gate.
6. Show selected fields rather than a wall of JSON.
7. Offer raw JSON as an optional expansion.
8. Create a private report URL.
9. Offer a sanitised public share card.
10. Ask for email only when saving or receiving the report.
11. Offer a first API key after verification.
12. Record method, confidence, category and failure reason.
13. Never publish submitted inputs without permission.

### 5.4 Report design

For each input show:

- Input
- Result state
- Product identity
- Confidence
- Method
- Price band if available
- Cost
- Failure reason or limitation
- Suggested implementation treatment

Implementation treatment examples:

- **Trusted:** Safe to accept at the configured threshold.
- **Partial:** Accept identity, reject price.
- **Below gate:** Route to a fallback or human check.
- **Null:** Do not let the agent infer a product object.

### 5.5 Share object

> **Agent product-data test**
>
> 4 of 5 inputs returned trusted product objects  
> 3 contained usable price ranges  
> 1 source refused machine access  
> Calibration: `[version]`  
> Tested with Legibility

Public cards must hide private inputs and company details by default.

### 5.6 Referral proposition

Do not offer money, fake points or queue-jumping.

Offer collaborative evidence:

> Invite another builder with a different product-data problem. When they complete a test, both of you receive a combined compatibility report.

---

## 6. Network mobilisation

### 6.1 Principle

Use the existing people system as a relevance and introduction graph, not a list to blast.

Its documented job is to turn relationship evidence into specific, well-shaped asks. It distinguishes identity, evidence, meaning and action; it also protects against invented warmth, unverified shared history and incomplete pagination.

Sources:

- [Network overview](https://github.com/krishanraja/control-center/blob/main/docs/app/people/network.md)
- [Imports](https://github.com/krishanraja/control-center/blob/main/docs/app/people/imports.md)
- [Review](https://github.com/krishanraja/control-center/blob/main/docs/app/people/review.md)
- [Warm paths](https://github.com/krishanraja/control-center/blob/main/docs/app/people/warm-paths.md)
- [Network strategy](https://github.com/krishanraja/control-center/blob/main/docs/app/people/NETWORK_STRATEGY.md)

### 6.2 Campaign pools

| Pool | Selection rule | Ask |
|---|---|---|
| Builders | Technical role plus agent, commerce, marketplace or product-data relevance | Test five inputs |
| Buyers | Owns commerce infrastructure or agent products | Nominate a technical evaluator |
| Multipliers | Runs a community, accelerator, fund platform, consultancy or portfolio function | Share the testbench |
| Amplifiers | Publishes relevant developer or agent work | Review the benchmark |
| Introducers | Strong relationship to a target builder or multiplier | Make one introduction |
| Subjects | Deep practical experience in extraction or agent commerce | Contribute one hard case |

### 6.3 Candidate scoring

| Factor | Weight |
|---|---:|
| Direct ICP fit | 30 |
| Evidence of a current relevant project | 20 |
| Measured relationship or credible warm path | 20 |
| Distribution potential | 20 |
| Timeliness, such as a launch or new role | 10 |

Rules:

- Draft a direct invitation at 70 or above.
- Draft an introducer request at 60 to 69.
- Research further below 60.
- Never infer warmth from a name match.
- Never claim shared employment means the people worked together.
- Never publish private network information.
- Every candidate needs a current relevance signal.

### 6.4 Month-one network inventory

Prepare:

- 60 direct builder invitations
- 30 introducer requests
- 20 multiplier proposals
- 10 expert contribution requests

These are not a sequence. Each is an individual, evidence-based draft.

### 6.5 Personalisation packet

Every approval item contains:

- Recipient and company
- Proposed pool
- Fit score
- Why now
- Evidence source
- Relationship basis or warm path
- Relevant Legibility use case
- Requested action
- Draft message
- Contact-history and suppression status
- Risk flags

### 6.6 Approval wall

The system may autonomously:

- Research
- Score
- Deduplicate
- Draft
- Prepare batches
- Classify replies
- Suggest follow-ups
- Update records

The system may not autonomously:

- Send a message
- Publish a post
- Submit a launch
- Spend money
- Delete records
- Change permissions

Krish approves each external action immediately before execution. This follows the source-of-truth operating rule that drafts never send automatically.

Source: [KRISH.md](https://github.com/krishanraja/control-center/blob/main/docs/KRISH.md).

### 6.7 Time budget

| Moment | Krish's task | Maximum |
|---|---|---:|
| Monday | Choose the week's acquisition emphasis | 10 min |
| Tuesday | Approve or reject invitation batch | 15 min |
| Thursday | Approve partner and publication batch | 15 min |
| Friday | Review evidence and select next experiment | 15 min |
| Buffer | Exceptional decision | 5 min |

Total: 60 minutes per week.

---

## 7. Autonomous growth system

### 7.1 Inputs

- Accounts and API keys
- Testbench events
- Product-read outcomes
- Website analytics
- Existing people graph
- Replies and bounces
- Referral events
- Public company and project evidence
- Community and registry opportunities
- Benchmark data
- Suppression records

### 7.2 Processing loop

1. Reconcile people, companies and sources.
2. Classify persona and use case.
3. Score ICP fit, relationship and distribution potential.
4. Research one current relevance signal.
5. Select the smallest credible ask.
6. Generate a personalised draft or partner proposal.
7. Run factual, claim and compliance checks.
8. Place the action in the approval queue.
9. Execute only after explicit approval.
10. Capture delivery, response, enrolment and activation.
11. Update the person, partner and channel score.
12. Recommend the next constraint to attack.

### 7.3 Daily cycle

#### 07:00: Reconciliation

- Import new accounts, tests, referrals and replies.
- Deduplicate identities.
- Update suppression status.
- Recalculate the funnel.
- Detect broken attribution, delivery or onboarding.

#### 08:00: Candidate generation

- Find ten relevant people or organisations.
- Collect one sourced current signal per candidate.
- Reject generic candidates.
- Produce no more than five high-quality drafts.

#### 09:00: Evidence production

- Analyse new trusted and failed tests.
- Select one useful aggregate finding.
- Draft a benchmark note, technical post or outreach reason.
- Flag every public claim requiring human verification.

#### 12:00: Response handling

- Classify replies as positive, question, referral, objection, later, no or opt-out.
- Draft the next appropriate response.
- Stop all follow-up on opt-out or clear mismatch.

#### 16:00: Optimisation

- Update channel forecasts.
- Identify the largest funnel constraint.
- Recommend one corrective action.
- Prepare the next approval batch.

### 7.4 Draft rejection rules

Reject any draft that:

- Could be sent unchanged to fifty people
- Claims “any URL”
- Hides known coverage limitations
- Uses false urgency or scarcity
- Asks for an upvote
- Claims a relationship unsupported by evidence
- Includes irrelevant personal data
- Sends after an opt-out
- Adds someone to a newsletter without valid permission
- Uses Krish's personal email for campaign work
- Leads with x402 where trust or product data is the actual use case

Use `hello@krishraja.com` until a dedicated Legibility sender is deliberately established.

### 7.5 Weekly strategy brief

The autonomous system prepares a one-page decision brief answering:

- How many verified users were added?
- Which channels produced activated users?
- Which partners distributed?
- Which messages received substantive replies?
- What did builders try to read?
- What failed, and why?
- Which funnel stage is constraining growth?
- What should stop?
- What single experiment should run next?
- What requires Krish's decision?

---

## 8. Distribution channels

### 8.1 Partner distribution

This is the largest planned source of users because it reaches relevant builders without paid spend or personal social accounts.

#### Targets

- AI engineering communities
- Agent-builder groups
- MCP communities and clients
- Commerce developer communities
- Accelerator cohorts
- VC platform and portfolio teams
- Developer newsletters
- AI engineering consultancies
- Product-data and scraping communities

#### Offer

> Give your builders a private five-product test and an aggregate compatibility report. No paid placement, no list sharing and no sales webinar required.

#### Partner kit

- Tracked landing page
- 100-word newsletter block
- 40-word community post
- Result-card image
- Three example inputs
- Honest coverage statement
- Seven-day aggregate report
- Contact for technical questions

#### Single-action asks

Ask for one, never all:

- Include the testbench in one newsletter.
- Post it in one relevant community.
- Invite ten portfolio developers.
- Contribute five difficult test cases.
- Host an asynchronous benchmark challenge.

### 8.2 MCP Registry

Publish Legibility in the Official MCP Registry with:

- Accurate `server.json`
- Public remote MCP endpoint
- Intent-led tool descriptions
- Input and output schemas
- Authentication instructions
- Working quickstart
- Coverage limitations
- Example calls
- Versioning policy
- Automated publication from CI

The official registry is an upstream metadata source intended to support discovery by clients and downstream marketplaces. Publication instructions use the MCP publisher workflow.

Sources: [Official registry announcement](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/) and [registry FAQ](https://modelcontextprotocol.io/registry/faq).

### 8.3 x402 Bazaar

Treat Bazaar as an experimental discovery channel, not a core forecast dependency.

Actions:

1. Add complete discovery metadata.
2. Use the supported facilitator.
3. Validate the public endpoint.
4. Complete one controlled successful testnet settlement.
5. Confirm the resource appears in discovery.
6. Test the path from agent search to paid response.
7. Mark Base Sepolia visibly at every step.

Coinbase describes Bazaar as a discovery layer through which developers and agents can search for x402-enabled services. Its documentation also exposes MCP-oriented discovery.

Sources: [Coinbase x402 Bazaar documentation](https://docs.cdp.coinbase.com/x402/buyer/discover-services) and [MCP payments discovery](https://docs.cdp.coinbase.com/x402/buyer/mcp-payments).

### 8.4 Developer publications

Publish the canonical article on Legibility first, then adapt it for relevant publications such as DEV Community or Hashnode where their rules permit.

#### Article 1: Why product-data confidence must be calibrated

- Extraction success is not the same as truth.
- Field-level and object-level confidence serve different decisions.
- Agents can apply different thresholds to different fields.
- Include a real response.
- State the limits of the current evaluation.

#### Article 2: Build a product-comparison agent without making it guess

- Use two to five product URLs.
- Explain price-band semantics.
- Handle null and below-gate results.
- Include a runnable example.
- Show expected failures.

#### Article 3: MCP versus REST for product-data agents

- When each interface fits.
- Authentication.
- Tool discovery.
- Latency and caching.
- x402 testnet caveat.
- Working setup snippets.

Every piece ends with the testbench, not a generic newsletter form.

### 8.5 Launch surfaces

Prioritise:

1. Official MCP Registry
2. Partner newsletters and communities
3. DEV Community and Hashnode technical posts
4. Developer-tool launch directories
5. Indie Hackers
6. Show HN
7. Product Hunt, only as optional amplification

A Show HN post should link directly to usable software. Do not ask contacts to upvote or coordinate voting. Use a literal title and disclose limitations in the maker comment.

Suggested title:

> Show HN: Test whether an agent can trust product data from a URL or barcode

### 8.6 Public benchmark

Create the **Agent Product Data Benchmark**.

Initial sample:

- 100 product inputs
- Structured-data shops
- Shopify storefronts
- Barcode identities
- Verified OpenGraph pages
- Known bot-protected domains
- Mixed product and non-product pages

Publish:

- Trusted-read rate
- Null rate
- Failure-reason distribution
- Price-band availability
- Method distribution
- Calibration version
- Sample size
- Date tested
- Selection methodology
- Clear warning that the sample is not the entire web

Update weekly. Each update becomes:

- A technical article
- A partner note
- A community post
- A company-specific outreach reason
- A product-prioritisation input

---

## 9. Outreach and partner copy

### 9.1 Direct builder invitation

**Subject:** A product-data test for `[project or company]`

Hi `[first name]`,

`[Specific, sourced sentence about their current product, project or role.]`

Legibility turns a product URL, barcode or name into a typed object with field-level confidence, a price range and the cost of the read. It is built for agents that need to know when not to trust an extraction.

The Founding 200 testbench will run five real inputs and return the compatibility report before asking you to integrate anything:

`[tracked link]`

Coverage is deliberately honest. Structured product pages, Shopify stores and barcodes are strongest today; some bot-protected retailers return no trusted result.

Would testing it against `[specific use case]` be useful?

Krish  
Legibility  
hello@krishraja.com

### 9.2 Introducer request

**Subject:** One relevant introduction for Legibility

Hi `[first name]`,

You know `[target]` through `[evidence-backed relationship]`, and their work on `[specific project]` appears close to the problem Legibility solves.

Legibility gives commerce agents typed product data with calibrated confidence, so they can reject unsafe results rather than guess.

Would you be comfortable forwarding the short note below? No broader endorsement is needed.

`[Forwardable paragraph]`

If the fit is wrong, no problem. A “not relevant” is useful evidence too.

### 9.3 Multiplier proposal

**Subject:** A free product-data test for your builders

Hi `[first name]`,

`[Specific sentence about the community, portfolio or programme.]`

Legibility is opening a 200-builder beta for teams working on shopping agents, procurement copilots, comparison tools and commerce infrastructure.

Members can test five real products and receive a private compatibility report. There is no paid placement, no requirement to share member details and no claim that every retailer works.

Would you be open to sharing the testbench with relevant builders in `[community or portfolio]`? A ready-to-use 100-word description is below.

### 9.4 Newsletter block

> **Can your agent trust the product data it just extracted?**
>
> Legibility turns a product URL, barcode or name into a typed product object with field-level confidence, a price range, source method and call cost. Its Founding 200 testbench lets builders try five real inputs before integrating. It works best today on structured product pages, Shopify stores and barcodes, and returns an honest null when a result is not safe to use.
>
> `[Test five products]`

### 9.5 Community post

> Building a shopping agent, procurement copilot or product-comparison tool?
>
> Legibility has opened a free five-product testbench. It returns typed product data, field confidence, price ranges and explicit failures rather than handing every extraction to the agent as if it were true.
>
> The current beta is strongest on structured pages, Shopify and barcodes. Hard, bot-protected retailers remain a known limitation.
>
> Testbench: `[link]`
>
> Technical questions and difficult failure cases are welcome.

### 9.6 Single follow-up

Send one follow-up unless the recipient responds.

> Hi `[first name]`,
>
> Closing the loop on the Legibility testbench. The relevant question is whether `[specific use case]` needs confidence-aware product data, not whether you need another scraping API.
>
> If it is irrelevant, reply “no” and contact stops here. If useful, the five-product test is at `[link]`.

---

## 10. Content engine

### 10.1 Evidence before opinion

Each week creates one primary evidence object and at least four derivatives.

| Evidence object | Derivatives |
|---|---|
| Benchmark update | Article, partner note, community post, outreach reason |
| Integration recipe | Documentation page, repository example, registry update, email |
| Failure analysis | Technical note, FAQ improvement, target list, product decision |
| Cohort pattern | Use-case page, onboarding change, partner pitch, roadmap evidence |

### 10.2 Editorial rules

- Publish measured findings, not generic AI commentary.
- Show sample sizes.
- Separate observation from interpretation.
- Put limitations beside claims.
- Include runnable examples.
- Link every article to a working test.
- Avoid “revolutionary”, “game-changing” and “any website”.
- Do not depend on Krish's personal social accounts.
- Let partners, registries, communities, search and direct relevance distribute the work.

### 10.3 Four weekly anchors

#### Week 1

**A machine-readable product is not necessarily a trustworthy product**

Explain extraction versus confidence using a small audited set.

#### Week 2

**What happened when Legibility tested 100 product inputs**

Publish the first benchmark with full methodology.

#### Week 3

**Five failure modes a commerce agent must handle**

Use actual categories and safe implementation patterns.

#### Week 4

**What the Founding 200 tried to read**

Publish only aggregate, permission-safe findings. If the cohort is below 200, use the exact number rather than pretending the goal has been reached.

---

## 11. Metrics and instrumentation

### 11.1 Event model

Track:

- `beta_page_viewed`
- `testbench_started`
- `testbench_completed`
- `beta_form_started`
- `beta_enrolled`
- `email_verified`
- `api_key_created`
- `first_call`
- `first_trusted_read`
- `first_null_read`
- `second_session`
- `referral_link_created`
- `referral_visited`
- `referral_enrolled`
- `feedback_submitted`
- `outcome_reported`
- `partner_link_visited`

Attach where lawful and useful:

- Source
- Campaign
- Partner
- Persona
- Use case
- Interface preference
- Relationship pool
- Referral parent
- Test method
- Trusted or untrusted state
- Failure reason
- Time to activation

### 11.2 Daily dashboard

Display:

- Verified enrolments against 225
- Net qualified users against 200
- Required daily run rate
- Enrolments and activations by source
- Testbench start and completion
- Report-to-enrolment conversion
- Enrolment-to-key conversion
- Key-to-first-trusted-read conversion
- Seven-day return rate
- Referral coefficient
- Partner contribution
- Suppression, complaint and bounce counts
- Paid media spend, fixed at $0

### 11.3 Decision thresholds

These are operational tripwires, not industry benchmarks.

| Signal | Trigger | Response |
|---|---:|---|
| Testbench start | Below 20% after 200 relevant visits | Rewrite hero and show output |
| Test completion | Below 60% after 100 starts | Reduce input burden or fix latency |
| Report to enrolment | Below 35% after 100 reports | Strengthen saved-report and cohort value |
| Enrolment to key | Below 40% after 75 enrolments | Remove onboarding steps |
| Key to trusted read | Below 50% after 50 keys | Improve examples and source selection |
| Direct outreach reply | Below 15% after 30 messages | Stop and rework targeting |
| Multiplier acceptance | Below 25% after 12 asks | Improve asset or partner offer |
| Complaint pattern | Any meaningful pattern | Pause the responsible motion |
| Referral enrolment | Below 10 after 100 members | Replace referral proposition |

### 11.4 Channel ranking

Rank channels by:

1. Activated users
2. Seven-day returning users
3. Relevant test cases
4. Structured feedback
5. Verified enrolments
6. Traffic

Traffic is last, not first.

---

## 12. Thirty-day execution plan

### Days 1 to 3: Build the acquisition surface

- Build `/builders-beta`.
- Implement the five-product testbench.
- Define counted enrolment.
- Add verification, source and referral attribution.
- Add use-case and interface fields.
- Produce private and sanitised report variants.
- Audit email delivery and suppression.
- Establish the dashboard baseline.
- Select the first 100 benchmark inputs.
- Prepare the first 30 network candidates.

**Exit condition:** A stranger can test, enrol, verify, create a key and complete a call without assistance.

### Days 4 to 7: Seed with high-quality builders

- Prepare and approve the first 15 relationship-rich invitations.
- Invite five expert subjects to submit hard cases.
- Invite five multipliers to preview the partner kit.
- Run and audit the benchmark.
- Publish the benchmark methodology.
- Repair every onboarding failure observed in the first ten users.
- Prepare MCP Registry metadata.
- Publish two integration recipes.

**Day-seven target:**

- 25 verified enrolments
- 15 API keys
- 10 trusted reads
- 3 multiplier commitments

### Days 8 to 14: Turn evidence into distribution

- Publish benchmark update one.
- Prepare and approve direct batch two.
- Prepare and approve the first introducer batch.
- Supply tracked kits to committed multipliers.
- Publish the MCP listing.
- Publish the confidence article.
- Submit to selected developer surfaces after approval.
- Add collaborative referrals.
- Run an asynchronous “five difficult products” challenge.

**Day-fourteen target:**

- 80 cumulative enrolments
- 45 API keys
- 25 trusted reads
- 10 referred enrolments
- 3 active partner sources

### Days 15 to 21: Concentrated launch window

- Publish the product-comparison tutorial.
- Run the approved community and developer launch sequence.
- Release benchmark update two.
- Use observed company-specific findings for targeted outreach.
- Approach agent platforms with an integration recipe.
- Verify x402 Bazaar readiness.
- Publish the first cohort pattern.
- Re-engage people who completed a test but did not enrol.

**Day-twenty-one target:**

- 155 cumulative enrolments
- 85 API keys
- 50 trusted reads
- 20 seven-day returning users
- 5 active distribution partners

### Days 22 to 26: Attack the constraint

Choose one response based on evidence:

| Constraint | Intervention |
|---|---|
| Low relevant traffic | Activate more partners and launch surfaces |
| Low test starts | Rewrite promise and show a sample report |
| Low completion | Simplify test inputs and improve latency |
| Low enrolment | Strengthen saved-report value |
| Low activation | Create guided first-call recipes |
| Low repeat usage | Send personalised coverage findings |
| Low referral | Replace the referral exchange |

**Day-twenty-six target:**

- 195 cumulative enrolments
- 105 API keys
- 65 trusted reads

### Days 27 to 30: Cross the line without lowering quality

- Publish the final monthly benchmark.
- Ask active members to invite one relevant collaborator.
- Ask contributing experts to share the aggregate finding.
- Prepare and approve the final high-confidence network batch.
- Send one permitted follow-up to non-responders.
- Remove invalid, duplicate and unverified records from the counted total.
- Publish what cohort evidence changed in the product.
- Invite activated users into the next research cycle.

**Final target:**

- 225 verified enrolments
- At least 200 net qualified users
- 120 API keys
- 75 first trusted reads
- 30 returning users
- 15 structured feedback or outcome submissions

---

## 13. Experiments

### Experiment 1: Result before registration

**Question:** Does experiencing the product before signup increase qualified activation?

- A: Register before running a test.
- B: Run the test, request email only to save the report.
- Primary metric: first trusted reads per relevant visitor.
- Guardrail: abuse and compute cost.

Expected winner: B. The existing homepage already embodies this mechanism by returning a verdict before offering email capture.

### Experiment 2: Lead promise

- A: Product data agents can trust.
- B: Stop building your own product-extraction stack.
- C: URL, barcode or name to a typed product in one call.

Measure activated and returning users, not form conversion alone.

### Experiment 3: Multiplier asset

- A: Private five-product report.
- B: Public benchmark.
- C: Partner-specific aggregate report.

Measure activated users per multiplier ask.

### Experiment 4: Visible rejection

- A: Standard output.
- B: Output with an explicit explanation of why an input was not trusted.

Measure key creation, return use and feedback quality.

### Experiment 5: Referral exchange

- A: Invite a collaborator.
- B: Receive a combined compatibility report.
- C: Contribute an anonymised case to the benchmark.

Measure referred activated users.

### Experiment discipline

- Run one material funnel experiment at a time.
- Preserve channel attribution.
- Define the decision before launch.
- Do not call a result from tiny samples.
- Keep qualitative evidence beside quantitative outcomes.
- Stop tactics that generate unqualified names even if volume looks good.

---

## 14. Compliance and conduct

### 14.1 UK B2B outreach

UK PECR rules distinguish corporate subscribers from individual subscribers such as sole traders and some partnerships. Unsolicited B2B email to corporate subscribers may be permissible, but sender identification, an opt-out route and data-protection obligations still matter.

Operational requirements:

- Prefer relevant corporate work addresses.
- Distinguish companies from sole traders.
- Record source and relevance.
- Document the lawful basis where personal data is processed.
- Identify the sender.
- Provide a simple opt-out.
- Maintain a global suppression list.
- Honour objections immediately.
- Retain no irrelevant personal enrichment.
- Do not subscribe outreach recipients to a newsletter automatically.
- Obtain appropriate advice before scaling internationally.

Primary guidance: [ICO B2B marketing guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/).

This playbook is operational guidance, not legal advice.

### 14.2 Community conduct

- Read and obey each community's rules.
- Ask moderators when promotion requires approval.
- Contribute technical value rather than dropping a link.
- Never coordinate votes.
- Never create fake supporters.
- Never pose as an independent user.
- Respond to criticism with evidence.
- Remove a post if moderators ask.

### 14.3 Claim standard

Every public performance claim should identify:

- What was tested
- When it was tested
- Sample size
- Selection method
- Calibration version
- Meaning of “trusted”
- Known exclusions
- Whether x402 is testnet or mainnet
- Whether a feature is live, experimental or planned

### 14.4 Privacy

- Test inputs stay private by default.
- Public reports must be sanitised.
- Partner reporting must be aggregate unless participants consent otherwise.
- Private network facts never appear in public campaign material.
- Referral identity is exposed only where both parties expect it.

---

## 15. Build priorities

### Must build

1. Dedicated developer beta page
2. Five-product testbench
3. Verified enrolment and source attribution
4. API-key activation path
5. Referral identity
6. Approval queue
7. Daily funnel dashboard
8. MCP Registry publication
9. Partner kit
10. Public benchmark

### Should build

- Sanitised share reports
- Integration recipes
- Coverage-request workflow
- Contributor recognition controls
- Automated weekly benchmark
- Company and use-case scoring
- Reply and outcome classification

### Do not build yet

- A large community
- A daily newsletter
- A points-based referral economy
- Paid sponsorships
- A complicated affiliate programme
- Mainnet-led messaging
- A broad AI-visibility platform
- An enterprise sales process
- Another AI-tools directory
- Features requested only by people who never activate

---

## 16. Immediate action register

### Product

- [ ] Create `/builders-beta`.
- [ ] Build the five-input testbench.
- [ ] Generate private compatibility reports.
- [ ] Add sanitised share cards.
- [ ] Connect verification to API-key creation.
- [ ] Preserve null and below-gate reasons.

### Data

- [ ] Define counted enrolment.
- [ ] Add campaign events.
- [ ] Add partner and referral IDs.
- [ ] Create daily funnel view.
- [ ] Create source-quality view.
- [ ] Confirm suppression behaviour.

### Network

- [ ] Generate six campaign pools.
- [ ] Score initial candidates.
- [ ] Research current relevance signals.
- [ ] Prepare first approval batch.
- [ ] Identify warm paths to ten external builders.
- [ ] Identify the first twelve multipliers.

### Distribution

- [ ] Produce partner kit.
- [ ] Prepare MCP Registry metadata.
- [ ] Verify x402 discovery prerequisites.
- [ ] Write the confidence article.
- [ ] Write the comparison-agent recipe.
- [ ] Select launch communities and read their rules.

### Evidence

- [ ] Define the benchmark sample.
- [ ] Freeze methodology before results.
- [ ] Run the first 100 inputs.
- [ ] Audit classifications.
- [ ] Publish sample, date and limitations.

### Governance

- [ ] Confirm dedicated sender identity.
- [ ] Confirm privacy language.
- [ ] Confirm outreach suppression.
- [ ] Confirm publishing approval flow.
- [ ] Confirm no tool can send autonomously.

---

## 17. Final operating instruction

Build the **Product Legibility Testbench** first and make it the centre of the month.

Every campaign action must do one of two things:

1. Deliver a qualified builder into the testbench.
2. Turn evidence produced by the testbench into further distribution.

If an activity does neither, remove it.

The strongest counterargument is that the testbench may expose many null results and depress signup conversion. That is an acceptable outcome. A campaign that acquires 200 people under a false “any URL” promise creates vanity demand and support debt. A campaign that proves where Legibility works, where it refuses to guess and what builders actually need creates a usable market signal.

The target is not a list of 200 email addresses.

The target is a first market of 200 relevant builders who understand the product honestly, have experienced it and can show what Legibility should become next.
