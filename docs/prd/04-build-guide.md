# BrandGauge: Product Requirements Document
## Document 4 of 5: Build Guide

| Field | Value |
|---|---|
| **Product** | BrandGauge |
| **Document** | 4 of 5: Stack, environment, conventions, definition of done, deployment |
| **Version** | 8.0 |
| **Owner** | Emmanuel Femi-Adejobi |
| **Status** | Live product |
| **Last updated** | 14 September 2026 |
| **Authoritative on** | Stack, tooling, versions, commands. When another document disagrees about any of those, this one wins. |
| **Versions verified** | 14 September 2026, read from `package.json` rather than recalled |
| **Reads with** | Doc 2 (data model and access rules) · Doc 3 (sequence) · Doc 5 (design system) |

v6's Build Guide was a guide to *starting* this build: install these tools, scaffold this
project, here is week one day by day. That document has done its job and most of it is now
history. This one is a guide to *working in* the build that exists.

The single biggest change: **Antigravity is gone from the workflow** (Doc 5, locked decision
5). The v6 guide was organised around a two-tool division of labour with Google's agent doing
visual work. That is no longer how this is built, and the reason is in the register.

---

## 1. Philosophy: maximum intelligence per naira

Three rules still decide every technology choice.

1. **Managed infrastructure for everything.** No servers to patch. Vercel runs the app,
   Supabase runs the data, Inngest runs the background jobs, Upstash runs the cache. Write
   product, not plumbing.
2. **AI through the API, never a trained model.** The cultural intelligence comes from
   prompting a frontier model well, and from the accumulated idiom corrections in Doc 3
   section B.1, not from training our own.
3. **One tool, owning the truth.** Claude Code holds the schema, the conventions, the
   `CLAUDE.md` and the source of truth. There is no second builder.

The biggest cost lever remains **model routing**. Route by tier and the AI bill stays an order
of magnitude below what it costs to send everything to the top model.

---

## 2. The stack, as installed

Read from `package.json` on 14 September 2026. Versions go stale in months and a stale
citation signals other stale assumptions, so this table gets re-read on every major revision
of this set rather than remembered.

### 2.1 Core

| Layer | Package | Version |
|---|---|---|
| Framework | `next` | 16.3.4, App Router, Turbopack by default |
| React | `react`, `react-dom` | 19.2.4 |
| Language | `typescript` | 5.x, strict |
| Styling | `tailwindcss` | 4.x, with `@tailwindcss/postcss` |
| Components | `@base-ui/react`, `shadcn`, `cmdk`, `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge` | current |
| Theme | `next-themes` | current |
| Database and auth | `@supabase/supabase-js` 2.108.1, `@supabase/ssr` 0.12.0 | |
| AI | `@anthropic-ai/sdk` 0.104.1 | `openai` 6.42.0 is present for the AI visibility tracker only |
| Background jobs | `inngest` 4.5.1 | Every async and bulk job, without exception |
| Cache and rate limit | `@upstash/redis` 1.38.0, `@upstash/ratelimit` 2.0.8 | |
| Charts | `recharts` 3.8.1 | |
| Tables | `@tanstack/react-table` | current |
| State | `zustand` 5.0.14 | |
| Forms | `react-hook-form` 7.78.0, `zod` 4.4.3, `@hookform/resolvers` | |
| Maps | `mapbox-gl` 3.24.0, `react-map-gl` | |
| Motion | `framer-motion` 12.40.0 | |
| PDF and email | `@react-pdf/renderer` 4.5.1, `resend` 6.12.4, `react-email`, `@react-email/components` | |
| Spreadsheet export | `exceljs` | |
| QR | `qrcode.react` | Secondary path only. See Doc 5, locked decision 4 |
| PWA | `next-pwa` 5.6.0, `workbox-window` | The ambassador app |
| Upload | `react-dropzone` | |
| Monitoring | `@sentry/nextjs`, `posthog-js` | |
| Payments | `stripe` | Present, unconfigured, and superseded by Paystack. See Doc 5 |

### 2.2 Two corrections to what the documents claimed

- **`d3` is not installed and not imported anywhere.** `CLAUDE.md` says "Recharts (+ D3 for
  Sankey/connectors)". That is wrong. Charting is Recharts only. Fix the document.
- **`lucide-react` is installed and imported nowhere.** The design system forbids an icon
  library and the product uses its own 113 drawn glyphs. The dependency is dead weight and
  should be removed before someone reaches for it. Doc 3 section A.4 carries it.

### 2.3 What is deliberately not here

No Python service. v6 planned one for the share of search job via `pytrends`; the product uses
a search API behind `SERPAPI_KEY` instead, which removes a whole runtime. No trained models.
No second AI provider for our own generation. No icon library. No animation library beyond
`framer-motion`. No `d3`.

---

## 3. Commands

The whole set. There are only six, and that is on purpose.

```bash
npm run dev          # local dev server, Next.js with Turbopack
npm run build        # production build. Must pass before a change is done
npm run lint         # ESLint, flat config in eslint.config.mjs
npx tsc --noEmit     # type-check the whole project. Must pass before a change is done
npm run icons        # rebuild the icon sprite and React module from brand/icons/currentcolor
npm run icons:check  # fail if a glyph the product asks for was never drawn
```

Database:

```bash
supabase migration list   # run FIRST. Confirm only your migration is pending
supabase db push          # apply to the linked project
```

The CLI authenticates through `SUPABASE_ACCESS_TOKEN` and is linked to the project. Port 5432
to the pooler occasionally times out on input and output; retry it.

**There is no unit test suite.** That is a deliberate state, not a gap being hidden. Behaviour
is verified by type-check, lint, and driving the actual flow. Section 7 says what that means.

---

## 4. Repository layout

```
src/app/**              Next.js App Router. Pages are server components by default.
                        API routes at src/app/api/**/route.ts
src/lib/**              Server-side logic:
                          ai/          the Claude client and prompt builders
                          supabase/    client factories, RLS and service
                          inngest/     background jobs
                          crypto.ts    AES-256-GCM encrypt and decrypt
                          active-brand.ts
                          bhi.ts       the one scoring function
                          industry-config.ts
src/components/**       React components, client and server, explicitly marked
src/proxy.ts            Auth middleware. Redirects unauthenticated users away from
                        /dashboard and /onboarding. Public paths are excluded in its matcher
supabase/migrations/**  SQL, timestamp-named YYYYMMDDHHMMSS_name.sql in UTC
brand/**                The design system. brand/DESIGN-SYSTEM.md is the contract
docs/prd/**             This set
video/**                Remotion sources for the brand film and the logo animation
scripts/**              icons-build.mjs
```

---

## 5. Environment variables

Every variable the code reads, what it gates, and whether it is set. **Check the variable
before promising a feature works end to end.** This table is the difference between a Built
feature and an Inert one.

### 5.1 Required for the app to run at all

| Variable | Gates |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks, jobs, public token routes. **Server only, never the client** |
| `ANTHROPIC_API_KEY` | Every AI feature. **Server only** |
| `TOKEN_ENCRYPTION_KEY` | Connector token encryption. Required in production |
| `NEXT_PUBLIC_APP_URL`, `APP_URL` | Redirects, links, emails |

### 5.2 Set, and carrying live features

| Variable | Gates |
|---|---|
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Every background job |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Cache, rate limits, OAuth state. **The scoreboard limiter and cache fail open if this is unavailable**, by design |
| `RESEND_API_KEY` | All email: briefings, reports, alerts |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | OOH and sighting maps |
| `META_APP_ID`, `META_APP_SECRET` | Instagram connect, Meta Ads |
| `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, `TWITTER_BEARER_TOKEN` | X connect and mentions |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in and GA4 OAuth |
| `GOOGLE_MAPS_API_KEY` | Place demographics, venue ratings |
| `GOOGLE_AI_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY` | The AI visibility tracker. At least one must be set; missing platforms are skipped |
| `ADMIN_SECRET` | Admin and seed endpoints, sent as `x-seed-secret`. **Fails closed if unset** |
| `NEXT_PUBLIC_SHORT_DOMAIN` | Vanity links at `/go/[slug]` |

### 5.3 Unset, each holding a feature Inert

| Variable | Would turn on |
|---|---|
| `SERPAPI_KEY` | **Four features at once:** share of search, the OOH to search uplift correlation, the geo-lift search arm, and the Google Trends competitive source. The highest-value single variable in this set |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | The entire WhatsApp module: survey delivery, NPS, quick pulse, the webhook. The access token must be a permanent system-user token, **never a page token** |
| `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads |
| `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` | HubSpot CRM and email |
| `TIKTOK_ADS_APP_ID`, `TIKTOK_ADS_SECRET` | TikTok Ads |
| `LINKEDIN_ADS_CLIENT_ID`, `LINKEDIN_ADS_CLIENT_SECRET` | LinkedIn Ads |
| `TWITTER_ADS_API_KEY`, `TWITTER_ADS_API_SECRET` | X Ads |
| `LEAD_ALERT_EMAIL` | The email that tells the lead desk a lead arrived |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | Nothing to turn on. Billing is Deferred and moving to Paystack. **Do not configure these** |
| `AFRICAS_TALKING_*` | Nothing that should run. Two code paths read these and both are defects. See Doc 3 section A.4 |

Set variables in three scopes in Vercel: development, preview, production. Never commit
`.env*`.

---

## 6. Conventions that are not negotiable

These come from Doc 2 and are restated here because this is the document someone has open
while building.

### 6.1 Data access

- `createClient()` is the **default**. `createServiceClient()` bypasses row-level security and
  is for webhooks, jobs, public token routes and cross-tenant admin work only.
- **Service client in a user-triggered request means verifying ownership manually.** A
  service-client query filtered only by an id from the request body is a cross-tenant hole.
  Verify through the row-level-security client first, or add `.eq('brand_id', <active brand>)`.
- Always `getActiveBrandId()` or `getActiveBrand()`. **Never**
  `.from('brands').select(...).limit(1).single()`.

### 6.2 Migrations

- One migration per change, `YYYYMMDDHHMMSS_short_name.sql`, UTC.
- **Written before the route that uses it.**
- Every new table: row-level security on, plus a workspace-scoped policy, **in the same
  migration**.
- Tokens encrypted with `encrypt()` from `src/lib/crypto.ts`. Never plaintext.

### 6.3 AI

- Route by tier through `callAi`. Model IDs live in `src/lib/ai/client.ts` and nowhere else.
- Parse JSON with `extractJson`. Never `JSON.parse` on a trimmed string.
- `export const runtime = 'nodejs'` and a `maxDuration` that fits the call.
- Cache Layer 1. Include the cultural block on every cultural-tier call.
- No model name in any UI, ever.

### 6.4 Interface

- Every component explicitly `"use client"` or explicitly a server component.
- Errors are sonner toasts. Loading is a skeleton shaped like the thing that is coming, never
  a spinner.
- Responsive from iPhone SE width up.
- Every new dashboard module ships a product tour: `data-tour` attributes, an entry in the
  tour definitions, and reachability from the persistent topbar trigger.
- Every value comes from `brand/tokens.css`. No hex, no `rgb()`, no `oklch()`, no Tailwind
  palette class. See Doc 5.

### 6.5 Copy

Warm, confident, plain English. Active voice. Connection before sales. No jargon. **No em
dashes.** Banned words: delve, underscore, pivotal, crucial, robust, vibrant, leverage,
seamless, tapestry.

---

## 7. Definition of done

A change is done only when all of the following hold. This list is the contract.

1. `npx tsc --noEmit` passes with no errors.
2. `npm run lint` introduces no new errors. Pre-existing warnings are acceptable.
3. For a database change: the migration is written, it enables row-level security with a
   workspace policy, and `supabase migration list` shows it as the only pending item before
   the push.
4. For a user-triggered route using the service client: ownership is verified per section 6.1.
5. For a new dashboard module: the product tour is wired, all three parts.
6. **You drove the actual flow and observed it work**, rather than assuming. When a fix
   exposes a new symptom, re-test after each step. Do not declare victory after the first fix
   in a chain.
7. User-facing copy obeys section 6.5.
8. The screen passes the ship audit in section 12 of `brand/DESIGN-SYSTEM.md`.

Item 6 is the one that gets skipped and the one that matters most. There is no test suite to
catch what it catches.

---

## 8. Workflow

```
Build → type-check and lint → drive the flow → show the diff → confirm → commit
```

A session commits as many features and fixes as land cleanly. Recent sessions ship five to
ten commits. The constraint is **each commit is one coherent, working change**, not one commit
per session.

Committing straight to `main` is the established habit. Where review tooling gates pushing or
merging to `main`, open a pull request and leave it, unless told otherwise.

```bash
git checkout -b <branch>
# build, verify
git add . && git commit -m "<message>"
git push -u origin <branch>     # Vercel creates a preview URL per branch
# verify on the preview, then merge
```

If a push fails on a network error, retry up to four times with exponential backoff: 2s, 4s,
8s, 16s.

---

## 9. Claude Code configuration

Four layers, in order of how much they matter.

### 9.1 `CLAUDE.md`

The project brain, at the repository root, read every session. It is the contract for working
in the repo and it is meant to be self-sufficient. **When it and the code disagree, the code
wins and the file is wrong. Fix the file.** Two places where it is currently wrong are named
in section 2.2.

### 9.2 Project skills

`CLAUDE.md` lists six:

| Skill | Purpose |
|---|---|
| `bp-feature` | Build a feature end to end the standard way |
| `bp-ai-prompt` | Construct a prompt with the mandatory three-layer and cultural block |
| `bp-supabase-rls` | Apply the standard policy to every new table |
| `bp-connector` | Build a connector: OAuth, encrypted tokens, Inngest sync |
| `bp-inngest-job` | Add a background job |
| `bp-security-audit` | Run an IDOR, row-level security, webhook, OAuth and secrets audit |

> **Portability gap.** These are not in the repository. They live in a user-level skills
> directory, so a fresh checkout or a cloud session does not have them, and the conventions
> they encode are then carried only by `CLAUDE.md`. Moving them to `.claude/skills/` in the
> repository would make them travel with the code. **Owner: Emmanuel. By: 15 October 2026.**

### 9.3 MCP servers

Worth having: Supabase (migrations, schema inspection, query debugging, the biggest time
saver), GitHub (branches, pull requests, diffs), Playwright (render a page, capture console
errors, verify a flow visually), and a documentation server so current library APIs are
fetched rather than recalled.

Skip the noisy ones. Fewer tools means sharper tool selection.

### 9.4 Hooks

Two earn their place: a guard that blocks any command touching `.env*` or printing a secret,
which matters given how many keys this project holds, and a formatter that runs after edits so
the diff under review is clean. Keep them narrow. They exist to stop two specific mistakes,
not to micromanage.

---

## 10. Security checklist

Run before every phase ships, and after any change to a route that touches tenant data.

- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` used server-side
      only. Grep the client bundle to confirm none leaked.
- [ ] Row-level security enabled on every tenant table, with a workspace policy.
- [ ] **Every service-client call in a user-triggered request verifies ownership.** This is
      the one that was violated in three routes on 11 July 2026.
- [ ] Public token routes (`/survey/[id]`, `/ambassador/[token]`, `/go/[slug]`,
      `/portal/[token]`, `/fso/[token]`, `/ref/[code]`) validate the token server-side and
      never use anon row-level security.
- [ ] The scoreboard, the one unauthenticated endpoint, still has its IP rate limit and cache,
      and both still fail open.
- [ ] All AI and external API routes rate-limited.
- [ ] All user input validated with Zod. File uploads type and size checked.
- [ ] Every webhook verifies its signature before doing any work: Paystack HMAC SHA-512,
      Flutterwave timing-safe compare, Meta and WhatsApp HMAC SHA-256 timing-safe, Stripe
      `constructEvent`. A provider that does not sign uses a shared secret and fails closed
      when unset.
- [ ] Admin and seed endpoints gated by `ADMIN_SECRET`, failing closed.
- [ ] OAuth state generated, stored with a short time to live, verified and consumed.
- [ ] Connector tokens encrypted at rest. Never logged.
- [ ] Phone numbers E.164 on `whatsapp_contacts` only, hashed in `whatsapp_send_log`.
- [ ] NDPR: consent captured on every collection tool, opt-out works, `whatsapp_opted_in`
      checked before any send, inbound STOP handled, retention limits set.

The NDPR item has the longest lead time in the whole project and it gates field deployment
rather than launch day. See Doc 3, risk 10.

---

## 11. Quality checklist

- [ ] Responsive from iPhone SE width up.
- [ ] The ambassador PWA tested offline: airplane mode, tap, reconnect, syncs once, no
      duplicates.
- [ ] Every scheduled Inngest job visible and succeeding in the dashboard.
- [ ] AI outputs spot-checked for hallucination, with confidence levels showing.
- [ ] Cultural accuracy: real Pidgin, Yoruba, Igbo and Hausa text run through the sentiment
      engine and checked by a native speaker.
- [ ] Loading and empty states on every async surface, and every empty state names the next
      action.
- [ ] Dark mode checked against both the page ground and the raised card, not toggled and
      glanced at.

---

## 12. Known environment limits when working remotely

Worth stating so a future session does not waste an hour rediscovering them.

- A cloud session's container is a fresh clone. The PRD set is in the repository now, at
  `docs/prd/`, which is a change from v6 and part of why this restructure happened: the v6
  set lived one level above the repository root and was therefore invisible to every remote
  session.
- Outbound network access is governed by the environment's policy. External hosts may be
  refused, which means the live app and live feeds cannot always be verified from a cloud
  session. Verify engine logic against a real-shaped fixture instead, and say which was done.
- Applying a migration needs `SUPABASE_ACCESS_TOKEN` and a linked project. Neither is present
  in a fresh cloud container, so migrations are written there and applied from a linked
  machine.
- Chromium is pre-installed for Playwright and has no H.264, so an MP4 will not decode. Use a
  VP9 source when verifying video behaviour.

---

## Next actions (Doc 4)

| # | Action | Owner | By | Blocking |
|---|---|---|---|---|
| 1 | Fix three wrong claims in `CLAUDE.md`: it says Recharts plus D3 (D3 is not installed), it says 107 supplied glyphs (there are 113), and it points the tour definitions at `src/components/tours/tour-definitions.ts` when the file is `src/lib/tour-definitions.ts` | Claude Code | 30 Sep 2026 | No |
| 2 | Remove `lucide-react` from `package.json` | Claude Code | 30 Sep 2026 | No |
| 3 | Move the six `bp-*` skills into `.claude/skills/` so they travel with the repository | Emmanuel | 15 Oct 2026 | No, but every cloud session is weaker without them |
| 4 | Remove the Stripe variables from any environment where they are set, so nothing half-configures | Emmanuel | With the Paystack work | No |

*End of Document 4 of 5.*
