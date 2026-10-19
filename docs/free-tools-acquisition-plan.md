# Free Tools & product-led acquisition — living plan

Started 14 October 2026. This is the resumable record for the Free Tools ecosystem:
five listed public tools that solve a marketing problem before anyone creates an account,
and a continuation path into BrandGauge Beta that keeps the work the visitor already did.
The lineup is the PR Scoreboard, the Brand Perception Gap, the Competitor Move Tracker, the
Market Demand Gap Finder and the Campaign Conversion Audit. The Offline Campaign Tracker is
built, retired from the lineup and still reachable; see Phase 8 in the worklog.

Beta is free. Nothing in here implements billing, trials, expiry dates or paywalls.
Stripe code elsewhere in the repo stays untouched and unconfigured.

## 1. Existing architecture, as audited

| Area | What is there | Verdict |
| --- | --- | --- |
| Framework | Next.js 16 App Router, server components by default, API routes at `src/app/api/**/route.ts` | Reuse |
| Marketing site | `src/components/landing/landing-page.tsx` holds `Nav` and `Footer`; `MarketingShell` wraps every non-root marketing page (`/features`, `/use-cases`, `/scoreboard`) | Reuse, extend `Nav` |
| Existing free tool | PR Scoreboard: page `src/app/scoreboard/page.tsx` → `ScoreboardPage`; API `POST /api/scoreboard/scan` and `POST /api/scoreboard/lead` | Preserve route and code |
| Public press engine | `src/lib/press/nigerian-press.ts` (Google News RSS, no credentials, ten Nigerian outlets, reach/EMV tables) and `src/lib/press/scoreboard.ts` | Reuse for competitor moves |
| Website reading | `scrapeWebsite()` inside `src/app/api/ai/brand-infer/route.ts` — plain `fetch` + strip tags, no SSRF guard, authenticated route only | Do **not** reuse as-is; new hardened fetcher for public tools |
| Anonymous lead data | `public_scans`, `leads`, `lead_desk_admins` + `is_lead_desk()` (migration `20260914090000_lead_capture.sql`). The one place RLS scopes to an allowlist instead of a workspace | Reuse pattern exactly |
| Link tracking | `GET /go/[slug]` resolves `print_placements` then `ooh_sites`, logs a visit, forwards UTMs, 302 | Extend with a third lookup |
| QR | `qrcode.react` already a dependency | Reuse |
| AI | `callAi({ tier })` + `extractJson` in `src/lib/ai/client.ts`. Tiers: cultural / structural / chat / boardGrade | Reuse, structural tier |
| Auth | Supabase. `POST /api/auth/callback` provisions workspace + member + blank brand for new OAuth users, then `/onboarding` | Reuse, add claim carry-through |
| Onboarding | `src/app/onboarding/page.tsx` + `actions.ts`. Three steps, no mandatory connector | Already connection-free |
| Tenancy | `is_workspace_member(ws uuid)`; every tenant table carries `brand_id` or `workspace_id` | Reuse |
| Rate limit / cache | Upstash Redis, fail-open, as in the scoreboard scan route | Reuse pattern |
| Background jobs | Inngest, `src/lib/inngest/` | Reuse for monitoring |
| Search data | `SERPAPI_KEY` already read by two Inngest jobs (`ooh-search-uplift`, `geo-lift-study`) | Reuse behind a provider abstraction |
| Analytics | `posthog-js` is a dependency but **not imported anywhere in `src`**. No event taxonomy exists | Build first-party events table |
| Design system | `brand/DESIGN-SYSTEM.md`, tokens in `brand/tokens.css`, 114 glyphs via `src/components/brand/icon.tsx`, marketing palette via `LP_VARS` | Reuse, invent nothing |

## 2. Decisions

1. **One registry.** `src/lib/tools/registry.ts` is the single source for the nav dropdown,
   the `/tools` directory and cross-tool recommendations. PR Scoreboard keeps `/scoreboard`;
   the registry carries its real route, so no existing link breaks.
2. **Anonymous runs, opaque tokens.** `tool_runs` holds every anonymous analysis. The visitor
   gets a 32-byte base64url token; the table stores only its SHA-256. A run is readable by
   token, by the lead desk, or by the workspace that claimed it. No personal data in a run.
3. **No second auth system.** Claiming is a normal authenticated action: `/tools/claim?token=…`
   runs after Supabase sign-in and attaches the run to the caller's workspace.
4. **Offline tracker owns its rows through the whole journey.** `tool_campaigns`,
   `tool_placements` and `tool_visits` start with a null `brand_id`; claiming sets
   `workspace_id` and `brand_id` on the campaign instead of copying rows, so a printed QR
   code never stops working.
5. **Evidence or silence.** Every finding in every tool carries a source URL and a
   provenance kind: `observed`, `estimated`, `interpreted` or `recommended`. Where a
   licensed provider is missing, the tool reports a visibility gap and says so, and never
   fabricates a search volume.
6. **An external assistant is evidence, never a generator.** The Brand Perception Gap asks
   ChatGPT, Gemini or Perplexity (whichever keys exist) how they describe a brand, and reads
   the answer as a public description of that brand. This is the AI Visibility exception in
   CLAUDE.md used for exactly what it is for. Our own output still comes from `callAi` only,
   the platform is never named in any UI, and an assistant answer carries no `sourceUrl`
   because none exists: the card renders it as a named, unlinked quote rather than a fake
   link. Shared in `src/lib/ai/assistants.ts`, which the AI Visibility job now also uses.
7. **A free tool never overwrites a configured brand.** The gap tool's claim importer fills
   only the brand fields that are empty, names what it filled, and says so plainly when the
   brand was already complete and nothing was written.
8. **SSRF-safe public fetching.** `src/lib/tools/fetch-public.ts` is the only way these
   tools touch a visitor-supplied URL: scheme allowlist, DNS resolution with private-range
   rejection, manual redirect following with re-validation, byte cap, timeout.

## 3. Data model added

Migration `supabase/migrations/20261014090000_free_tools.sql`:

- `tool_runs` — anonymous analysis sessions (token hash, inputs, result, provenance, expiry, claim).
- `tool_events` — the acquisition funnel taxonomy.
- `tool_campaigns` / `tool_placements` / `tool_visits` — offline tracker, anonymous then claimed.
- `competitor_moves` — verified competitor developments, workspace-scoped.
- `acquisition_opportunities` — demand-gap workspace, workspace-scoped.
- `page_audits` / `page_audit_findings` — campaign audit workspace, workspace-scoped.

RLS: workspace tables use `is_workspace_member()`. Anonymous tables are service-role write
and `is_lead_desk()` read, plus a workspace-member read once claimed.

## 4. Phases and status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Repository audit, this document | Done |
| 1 | Free Tools nav dropdown, `/tools` directory, registry, anonymous run infra, claim flow, event taxonomy, shared report components, abuse protection | Done |
| 2 | Competitor Move Tracker (public + beta workspace + Inngest monitoring) | Done |
| 3 | Market Demand Gap Finder (public + beta workspace) | Done |
| 4 | Offline Campaign Tracker (links, QR, redirect analytics, response forms) | Done |
| 5 | Campaign Conversion Audit (public + improvement plan workspace) | Done |
| 6 | Cross-tool QA, regression on PR Scoreboard, docs | Done |
| 7 | Email gate after the result, lead trail across tools, scoreboard folded into the same capture, demo rows for the desk | Done |
| 8 | Offline Campaign Tracker retired from the lineup, Brand Perception Gap built in its place | Done |

## 5. Credentials and operational status

| Capability | Gate | State |
| --- | --- | --- |
| Brand gap: stated identity + press | none (public pages, Google News RSS) | Fully implemented |
| Brand gap: how AI assistants describe you | any of `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `PERPLEXITY_API_KEY` | Implemented; with none set the reading is press-only and the coverage list says so |
| Competitor press + announcements | none (Google News RSS, public pages) | Fully implemented |
| Competitor move classification | `ANTHROPIC_API_KEY` | Fully implemented |
| Demand-gap search evidence | `SERPAPI_KEY` | Implemented; without the key the report switches to a labelled visibility gap and says no search volume was measured |
| Landing-page performance | `PAGESPEED_API_KEY` optional; PageSpeed Insights also answers keyless at low quota | Implemented; without an answer the audit runs its HTML, CTA, local-readiness and tracking checks and states that it makes no claim about speed |
| Offline tracking links + QR | none | Fully implemented |
| Rate limiting / caching | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Implemented, fails open |
| Lead desk visibility | row in `lead_desk_admins` | Existing mechanism |

## 6. Risks

- **Google News RSS is unlicensed and unversioned.** It already carries the PR Scoreboard. A
  feed failure is reported as a failure, never as silence.
- **Sites that block datacentre traffic** return nothing. Every tool states which sources it
  could not read rather than filling the gap.
- **Cost.** One structural AI call per analysis, results cached by normalised input for six
  hours, IP rate limits per tool. No AI call is made where parsing answers the question.
- **Claim collision.** A run already claimed by another workspace is refused.

## 7. Acceptance criteria

Per tool: public page renders, inputs validate, backend does real work, findings carry
evidence, failures degrade gracefully, no signup gates the promised value, and the email gate sits after a complete, sourced finding rather than before it, the CTA registers,
the run survives registration, the matching dashboard module opens populated, no connector is
mandatory, events are recorded.

Ecosystem: "Free Tool" is now "Free Tools", it is a dropdown, PR Scoreboard still works at
`/scoreboard`, every listed tool appears in the dropdown and in `/tools`, desktop and mobile both
work, and a sixth tool is one registry entry away.

## 8. Testing

`npm run tools:check` exercises the Free Tools libraries offline, in the shape the repo
already uses for `metrics:check` and `seeds:check`: the modules are compiled standalone with
the AI and press calls stubbed, so no key and no network are needed. 214 checks cover the SSRF
screening, the HTML reader against a fixture page, `findSectionLinks`, the registry's
invariants, `safeNext`, and the competitor classifier's source guard (a citation it cannot
point at, an undated page demoted off a change claim, malformed JSON, the three-finding cap),
the demand finder's guards (an opportunity with no citable evidence dropped, a demand claim
demoted to a content gap when no search provider answered, the market-code mapping), and the
offline tracker's UTM handling, slug generation and bot filtering (a WhatsApp link preview is
not a visit), and the audit's measured checks, its ordering, and the rule that a model's reading
of page copy can never be labelled as measured. A wiring block covers the regressions a type
error cannot catch: a tool in the dropdown with no page behind it, the nav label drifting from
"Free Tools", the PR Scoreboard's route moving, a dashboard module shipped without a product
tour or a nav entry, `/go` losing one of its three lookups, and any new table missing RLS or
granting anon access.

It has already caught one real hole: an IPv4-mapped IPv6 address reaches `screenHost` in hex
form, because the WHATWG URL parser serialises `::ffff:10.0.0.1` as `::ffff:a00:1`, so the
dotted-form check alone let `10.0.0.1` through.

**Not verifiable in this session.** The cloud container's egress policy denies CONNECT to
arbitrary hosts, so no live source read (a competitor's website, Google News RSS, PageSpeed)
can be exercised from here, and neither can a Supabase round trip or an Anthropic call. The
migration has not been applied, and every live-source path is therefore verified against
fixtures and stubs rather than against the real thing. Driving the real flow needs a
deployment, or a session whose network policy allows those hosts.

## 8b. What is deliberately not built

So the next session does not go looking for it, or rebuild it by accident:

- **Three migrations are written and not applied.** `20261014090000_free_tools.sql` and
  `20261014110000_fix_notifications_rls.sql` are applied. Still pending:
  `20261018094000_tool_lead_capture.sql` (renamed from `…18090000…` on 19 October: main had
  shipped `20261018090000_desk_accounts.sql` on the same timestamp, and the ledger keys on
  that timestamp, so two migrations could not share one. Widens `leads_source_check`, adds `leads.role` and
  `leads.website`, creates `lead_tool_runs`, adds the two gate events),
  `20261019090000_scoreboard_lead_trail.sql` (backfills `lead_tool_runs` from existing
  scoreboard leads) and `20261019100000_demo_leads.sql` (adds `leads.is_demo`). Lead capture
  and the desk's trail do not work until they are. On a machine with CLI access:
  `supabase migration list`, expect exactly those three, then `supabase db push`. From a
  Claude Code cloud session, where `db push` cannot open a Postgres connection:
  `npm run db:pending` to see the plan, then `npm run db:apply`. Both paths write the same
  ledger, so it does not matter which is used.

- **Content opportunity briefs and an in-workspace research refresh** for the demand finder.
  The workspace imports, prioritises, tracks and summarises opportunities; it does not yet
  generate a content brief per opportunity, and re-running the research means re-running the
  public tool.
- **Conversion experiments.** No experiment framework for headlines, CTA placement or
  registration timing. The copy and the registry are centralised, which is what makes it
  cheap to add later. Nothing fakes urgency or an end date for the beta, and nothing should.
- **An end-to-end browser suite.** The repo has no test runner and no Playwright setup, and
  `tools:check` follows the existing `metrics:check` / `seeds:check` pattern instead. The
  anonymous-to-beta journey is therefore checked at the unit and wiring level, not driven in a
  real browser.
- **A notification centre.** See below.

## 9. Known issues found on the way

**The `notifications` RLS policy was broken and is fixed here.** Migration
`20260628000001` wrote `using (is_workspace_member(brand_id))`, and that helper takes a
*workspace* id, so the predicate was false for every row and every caller: no signed-in user
has ever been able to read a notification. Two existing jobs (volume surge, campaign target
monitor) have been writing rows nothing could read, and the one query that reads the table
(`dashboard/brand-equity`) has always come back empty. It surfaced because the competitor
watchlist alerts write to the same table. Fixed in `20261014110000_fix_notifications_rls.sql`
with the standard shape: resolve the workspace through the brand.

**There is no notification-centre UI.** `NotificationBell` is a static button with a
`hasUnread` prop and nothing lists notifications. So a watchlist alert is a readable row that
the dashboard can query, and the place a marketer actually sees new competitor moves is the
watchlist timeline, which separates new from baseline. Nothing in the product claims an alert
is delivered anywhere it is not.

## 10. Worklog

- **19 Oct 2026 — Phase 8.** Brand Perception Gap built at `/tools/brand-gap`, in a new
  `brand` category that leads the directory. Two passes: what the brand says about itself,
  read off its homepage and its about and values pages, where every value must carry a quote
  that actually appears in the text we fetched; then how the press and an AI assistant
  describe it, and the divergences between the two. Four kinds, and only one of them
  (`missing`, a claim nobody repeats) may cite no outside source, because absence is
  evidenced by their own words. Everything else without a valid source index is dropped.
  The external assistant query moved to `src/lib/ai/assistants.ts` and the AI Visibility job
  now shares it. `Evidence.sourceUrl` became optional for the one source that has no
  address; the card renders it named and unlinked. Claiming fills only the empty fields on
  the brand and says which. 269 offline checks, up from 245.
- **19 Oct 2026 — Phase 7, part two.** The PR Scoreboard's lead form routed through the
  shared `captureLead`, so it joins the trail instead of keeping its own upsert; a role
  dropdown added to it; `20261019090000_scoreboard_lead_trail.sql` backfills the existing
  scoreboard leads into `lead_tool_runs`; and the desk can seed and purge six demo rows so
  the trail block can be seen before real leads arrive.
- **18 Oct 2026 — Phase 7, part one.** The email gate: `src/lib/tools/gate.ts` trims the
  report and the machine arrays on the server, so the withheld findings never reach the
  browser. Three fields (email, name, role); company is derived from the website the tool
  already has. `captureLead` reads before it writes, never changes first-touch `source`, and
  never blanks a field an earlier run filled. The Offline Campaign Tracker was unlisted the
  same day: QR on a Lagos billboard is not a measurement, and it was the only tool that ended
  with homework rather than a finding. Its page, API, tables and `/go` resolution all stay.
- **14 Oct 2026 — Phase 0.** Audit complete, this document written.
- **14 Oct 2026 — Phase 1.** Registry, `/tools` directory, Free Tools dropdown (plus the
  marketing nav's first mobile menu), `tool_runs` / `tool_events`, SSRF-safe fetcher, HTML
  reader, provenance-aware report components, claim flow, and `next` carried through the whole
  auth round trip behind `safeNext`. Migration `20261014090000_free_tools.sql` written, not yet
  applied.
- **14 Oct 2026 — Phase 6.** Founder funnel views (`free_tool_funnel`,
  `free_tool_qualified_accounts`, both `security_invoker`) and the page at
  `/dashboard/leads/funnel` behind the lead-desk allowlist; nightly retention job for
  unclaimed runs; the PR Scoreboard wired into the same event taxonomy and given the shared
  contextual suggestion without touching its route, its API or its markup; wiring regression
  checks; CLAUDE.md updated to match the code; the `notifications` RLS bug above fixed.
- **14 Oct 2026 — Phase 5.** Campaign Conversion Audit: PageSpeed Insights wrapper that keeps
  lab and real-user field data apart, deterministic markup, CTA, local-readiness and tracking
  checks, a model reading of the copy that is always provenance `interpreted`, public page, and
  an improvement-plan module with per-finding status, a re-audit that marks what did not come
  back as fixed, audit history per page and a paste-ready plan. No overall score and no revenue
  estimate anywhere, on purpose.
- **14 Oct 2026 — Phase 4.** Offline Campaign Tracker: per-placement short links and QR codes
  with no account, `/go/[slug]` extended with a third lookup (slugs minted against all three
  redirect tables, because a printed code cannot be reissued), visit recording that separates
  uniques from repeats and records-but-excludes automated hits, an anonymous campaign dashboard
  retrievable by token, the claimed campaign module with placement comparison and CSV export,
  and a consent-gated branded response page at `/respond/[campaignId]` that attributes each
  enquiry to the placement it came from.
- **14 Oct 2026 — Phase 3.** Market Demand Gap Finder: search-provider abstraction over the
  `SERPAPI_KEY` the OOH jobs already use, two-pass engine (read the business, then rank gaps
  against numbered evidence), public page, open API route, acquisition-opportunity backlog
  module with status tracking and a paste-ready team summary, product tour. Without the key the
  report switches to content gaps read off the company's own pages and says in the body that no
  search data was measured.
- **14 Oct 2026 — Phase 2.** Competitor Move Tracker: engine, public page with SEO and
  JSON-LD, open API route with per-IP limit and six-hour cache, watchlist dashboard module with
  baseline/new/site-change separation and on-demand AI readings, weekly Inngest check, product
  tour. `npm run tools:check` added and green.
