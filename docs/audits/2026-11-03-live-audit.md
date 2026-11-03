# BrandGauge live audit: https://brandgauge.app, 3 November 2026

Auditor: Claude, working through headless Chromium (Playwright). Every screenshot path is under
`/tmp/claude-0/-home-user-brandpulse-ai/1670c41e-7b70-505d-ae4a-e08a720d403c/scratchpad/live-audit/shots/`
(written below as `shots/...`). Scripts and raw JSON logs are in the same `live-audit/` folder.

**The live site runs an older build than this checkout.** For example, live onboarding has 3 steps and 13 industries, while the repo has 4 steps and goals; `/dashboard/settings/modules` returns 404 live. Code pointers below refer to the current checkout and are marked "likely" where the live build may differ.

## Test login

| | |
|---|---|
| URL | https://brandgauge.app/auth/login |
| Email | adebusuyiadejobi+bgaudit@gmail.com |
| Password | `(kept out of git; see the session chat)` (also in `live-audit/password.txt`) |
| Name / brand | BG Audit / "BG Audit Test" (Fintech chosen at onboarding) |

Signup needed email confirmation. The owner clicked the link, and the logged-in audit went ahead after that.

Test data this audit left in the account:
- Mailchimp key, Brevo key and Apple App ID, each set to the string `not-a-real-key`. There is no disconnect control in the UI, so they could not be removed.
- One dashboard layout choice (Fintech Growth).
- The profile name was changed and then changed back.
- Moniepoint was added as a competitor and then removed.
- Several anonymous free-tool runs.

---

## Top 10: what most hurts a real brand onboarding (ranked)

1. **New sign-ups land on a "Welcome back / Sign in" screen with no "check your email" message (blocker).** Signup always redirects to `/onboarding`. With confirmation on there is no session, so the user sees the login page. If they try to sign in, they get the raw Supabase text "Email not confirmed". `shots/signup-result.png`, `shots/login-attempt.png`. Cause: `src/app/auth/actions.ts` `signup()` calls `redirect('/onboarding')` without checking `data.session`. It also sets no `emailRedirectTo`, so a free-tool `next` is lost.
2. **Every new brand is saved as FMCG, whatever industry the user picks (serious).** I picked Fintech. Settings → Brand shows FMCG selected (`shots/settings-brand-type.png`), and the Brand Equity page reads "Brand Health Index **fmcg Weights**". That breaks the `brand_type` rule for BHI weights, funnel signals and nav. Cause: `src/app/onboarding/actions.ts` writes `industry` and `category` but never `brand_type`, and the column defaults to `'fmcg'` (`supabase/migrations/20260629000000_brand_type.sql`). Onboarding also shows Category = "Other" after the user picked Fintech; the inference result overwrites the pick.
3. **The Business Case writes a board-grade AI case from zero data (serious).** On an empty brand it shows "Zero spend, zero presence: invest now or cede Nigeria's fintech market permanently", "infinite percentage improvement in Share of Voice", "the brand has no market presence whatsoever", and invented budget asks of ₦4.5m / ₦3m / ₦2.5m. `shots/mod/_dashboard_business_case-1280.png`. Cause: `src/app/dashboard/business-case/ai-executive-brief.tsx` calls `callAi({tier:'boardGrade'})` on every render. It has no data-sufficiency guard, no cache and no `meta` (so cost lands as `unattributed`).
4. **The Billing and Client Portal pages show a trial, prices and upgrade prompts (serious, against the "Beta is free" rule).** Billing reads "Starter · Trialing", "Brands 1 / 1", "AI calls 0 / 100", "Upgrade to Growth ₦299k/mo", "Upgrade to Pro ₦699k/mo". Portal reads "Your starter plan supports 0 portal links. You've reached your portal link limit. Upgrade to add more". So the portal is unusable. Brands says "Your beta plan supports unlimited brands", which contradicts Billing's 1/1.
5. **The API-key connectors accept anything and then say "Connected" (serious).** Mailchimp and Brevo saved with `not-a-real-key` return "Mailchimp connected." and "Brevo (Sendinblue) connected.", and the cards show **Connected**. Apple App ID `not-a-real-key` shows **Configured**. There is no disconnect button. Brevo's "Sync now" calls `/api/connectors/mailchimp/sync`. Cause: `src/app/api/connectors/{mailchimp,brevo,app-store}/configure/route.ts` make no validation call to the provider.
6. **The Digital Ads page prefetches the OAuth connect routes and loops (serious).** Its "Connect" buttons are Next `<Link>`s to `/api/ads/{meta,google-ads,twitter}/connect`. On view, Next prefetches them, which mints OAuth state on GET, follows the 307 to facebook.com (CSP console error) and to `?error=*_not_configured`, and then re-prefetches. The page never reaches network idle (goto timed out at 45s, twice). Google Ads and X Ads are offered as "Connect", but both bounce to `?error=google_ads_not_configured` / `twitter_not_configured` **with no message shown** (no toast). Cause: `src/app/dashboard/digital/page.tsx:647` (`<Link href={p.connectHref}>`). Use `<a>`, or `prefetch={false}`, and mark Google Ads and X as "Coming soon" like the Connectors page does.
7. **The A/B Testing list API returns 500, and the page silently says "No experiments yet" (serious).** `GET /api/experiments` → 500 `Could not embed because more than one relationship was found for 'ab_experiments' and 'ab_variants'`. Cause: `src/app/api/experiments/route.ts:36` embeds `ab_variants` without naming the FK. `winner_variant_id` adds a second relationship (`supabase/migrations/20260702000007_ab_testing.sql:55`). Fix: `ab_variants!ab_variants_experiment_id_fkey(...)` (check the FK name).
8. **The free tools sometimes give a confident but stale or wrong lead finding (serious for acquisition).**
   - Brand Gap (Kuda) leads with a "CONTRADICTED · OBSERVED · HIGH CONFIDENCE" finding whose only evidence is a **2024-04-29** story. The report is stamped "Researched 3 November 2026" and gives no age warning.
   - The quote shows a leaked `&nbsp;&nbsp;` entity.
   - It says "Every assistant we asked said it does not know this brand" about Kuda, which is suspicious and should be checked.
   - Campaign Audit's top "FIX BEFORE YOU SPEND MORE" item says Kuda's "Deposits insured by" sentence is cut off. That is almost certainly an NDIC logo image the HTML reader dropped, so the AI reading reports it as a defect.
   - The audit also shows the env var name to visitors: "No PAGESPEED_API_KEY is set".
9. **Competitor Tracker fails completely when the competitor's site blocks server fetches (serious).** Kuda vs moniepoint.com gave: "We could not read moniepoint.com... the press search below is unaffected". No press search ran or appeared. The run returns `status:"failed"` before the press step. Cause: `src/lib/tools/competitor-tracker.ts:124-132` returns early when the homepage fetch fails. It should continue with the press, app and X sources, and the copy needs fixing. (Kuda vs palmpay.com worked well: a recent 2026-10-23 move, with a source.)
10. **The WhatsApp module shows raw server env vars to customers (serious).** The page reads "WhatsApp not configured. Add your WhatsApp Business API credentials… WHATSAPP_PHONE_NUMBER_ID= WHATSAPP_ACCESS_TOKEN= …". That contradicts Model A (users never touch an API key). `shots/mod/_dashboard_whatsapp-1280.png`. The Meta card message in `src/components/dashboard/meta-ads-connect-card.tsx:55` likewise names `META_APP_ID`.

---

## Findings by area

### 1. Public pages (logged out), at 1280px and 375px
Method: `public.js` loaded 28 paths at both widths. It captured console errors, failed requests, every XHR status, horizontal overflow, em dashes and banned words. Raw data: `public.json`, `shots/*-1280.png`, `shots/*-375.png`.

- **Works:** home, /features, /use-cases, /privacy-policy, /tools, all four tools, /scoreboard and the auth pages all return 200. None has horizontal overflow at 375px. There were no JS page errors and no failed API calls.
- **Em dashes in user-facing copy (minor, Voice rule):**
  - Every `<title>`, e.g. "BrandGauge — Brand intelligence…" and "Features — BrandGauge".
  - /privacy-policy (4 lines).
  - The demo cards on /auth/login ("Mobile payments app — PR crisis…").
  - Many dashboard pages: ooh/new, events/new, field-intelligence, funnel, competitive, cultural, PR, print, creative-library, mmm, business-case, methodology, connectors, ask, settings (connections, field-teams, ooh-domain), surveys (nps, panels), whatsapp/contacts, digital (create-ad, drafts), voice-builder.
  - The suggested question "Show CAC by channel — is Meta cheaper…".
- **Banned word (minor):** /dashboard/methodology uses "highest-leverage channel".
- **404s are the unbranded Next default (minor).** /survey/<bad>, /ambassador/<bad>, /fso/<bad>, /respond/<bad> and any unknown path show a bare "404 | This page could not be found." page with no logo and no way home (`shots/_survey_does_not_exist-375.png`). There is no `src/app/not-found.tsx`.
- **/go/<bad slug> (minor, by design?):** it silently 302s to the homepage with no "link not found" message (`src/app/go/[slug]/route.ts:103`). Someone scanning a billboard with a mistyped slug lands on the marketing homepage.
- /portal/badtoken returns 200 with "Link not found / Invalid token". That is fine, but it should be a 404 status.
- /auth/reset-password renders the form with no token. Submitting it was not tested.
- `/dashboard` and `/onboarding` when signed out redirect to `/auth/login` **without `?next=`**, so a deep link is lost after login (minor). Cause: `src/proxy.ts:121,124`.
- `/tools/claim` when signed out goes to `/auth/signup?next=%2Fdashboard`. That works.
- Home: `brandgauge-unveil.mp4` is aborted on load. This is likely just the video being lazy or paused, so it is not an error.

### 2. Signup and onboarding
- **Signup → blocker #1 above.**
- Onboarding live is 3 steps: Industry (13 options) → Brand name and website → Review AI suggestions → "Save profile and open my dashboard". It finished and landed on `/dashboard` (`shots/onb-*-375.png`, `shots/onb-4-review-full.png`).
- **Brand research works.** `POST /api/ai/brand-infer` returned 200 in about 15s. With only the name "BG Audit Test", it marked itself "Low confidence, review carefully · Drawn from: Brand name". It still invented a full profile: audit-firm values, segments such as "Public Sector & NGOs", and cultural sliders. That is acceptable because it is labelled, but a fintech pick gave a professional-services profile, because the industry pick is not passed to inference (`src/app/onboarding/page.tsx` sends only `brandName, websiteUrl`).
- **Category shows "Other" even though Fintech was picked** (serious, part of #2). `result.category || 'Other'` overwrites the industry pick.
- **Two taxonomies (serious, part of #2):** onboarding offers 13 industries (Telco, QSR, Healthcare, Insurance…). Settings → Brand offers the 8 `brand_type` values. Nothing maps one to the other, so `brand_type` stays `fmcg`.
- **Layout at 375px (minor):** in the review step's cultural sliders, the right-hand label ("Corporate") overflows the card by about 12px (`shots/onb-4-review-full.png`).
- The "Sign out" link is a GET to `/api/auth/signout`, which mutates on GET (minor). CLAUDE.md's impersonation guard assumes nothing mutates on GET; it is safe only because `/api/` is blocked anyway.
- A minor robustness risk in `onboarding/actions.ts`: `.single()` on `workspace_members` by `user_id` fails for a user in more than one workspace.

### 3. Dashboard modules
Method: `modules.js` opened all 63 sidebar and settings links at 1280px, and at 375px in a second pass (43 of 63 had finished when this was written, with no new issues beyond those listed). For each it captured toasts, API status, skeleton and spinner counts, tour presence, overflow and copy. Raw data: `modules-1280.json`, `modules-1280.log`, `modules-375.log`, `shots/mod/*`.

**All modules returned 200 and rendered an empty state, except where noted.** No spinner stayed on screen and no error toast fired anywhere.

| Module | Result | Severity |
|---|---|---|
| First dashboard visit | A "Set up your dashboard" modal: Fintech Growth preselected (good), but cards use emoji 🛒💳🏆🗺 (design system: icons only) and widget chips read like code ("bhi score", "ltv cac", "roas channel"). After the modal, the home page shows the same four empty metrics three times (N/A tiles, "—" tiles, and BHI/Sentiment/SOV cards). | minor |
| Home 1280 and 375 | Two round floating buttons sit on top of the "Chat with us" pill, hiding its text (`shots/mod/_dashboard_sentiment-375.png`, `_dashboard_business_case-1280.png`). | minor |
| /dashboard/digital | See #6. The page never settles. | serious |
| /dashboard/experiments | `/api/experiments` 500, see #7. | serious |
| /dashboard/business-case | See #3. | serious |
| /dashboard/retention | Shows **"Risk Score 15 / 100 · Low Risk"** with no NPS, sentiment or BHI data at all. It invents a reassuring number. | serious |
| /dashboard/brand-equity | "fmcg Weights" for a fintech brand (#2). Console error `<svg> attribute height: Expected length, "auto"`. At 375px the empty gauge renders as scattered needle fragments. | serious / minor |
| /dashboard/creative-fatigue | "All active creatives are healthy. No fatigue signals detected" when there are no creatives at all. A misleading empty state. | minor |
| /dashboard/content | Internal jargon in the UI: "Data populates once the mention crawl runs (Spine Layer 2)". | minor |
| /dashboard/whatsapp | Env var names shown (#10). | serious |
| /dashboard/ooh/new | React hydration error #418. The Mapbox CSS is blocked by CSP (`style-src 'self' 'unsafe-inline'`), so the map likely renders unstyled. | minor |
| /dashboard/ask | `GET supabase.co/auth/v1/user` → 401 on load (the client calls `getUser` without a usable session). Asking a question with no data gives a clean, honest 422 message with CTAs. Good. | minor |
| /dashboard/events | Shows a fake "Brand Activation — Example Event, 14 Jun — 16 Jun" preview. It is labelled as a preview, which is OK. | minor |
| /dashboard/board-pack | Copy: "Brand health is Awaiting data, with a BHI score of N/A out of 100." | minor |
| /dashboard/pr | "crawls … nightly at 7 AM". "Run crawl now" gives no toast or confirmation (POST /api/inngest/trigger-pr 200). | minor |
| /dashboard/sentiment | "Run crawl now" with nothing connected returns 200 and an inline "No social accounts connected yet". No toast. At 375px the "Crawl history" button is clipped off the right edge. | minor |
| /dashboard/cdp "Sync data" | 200, nothing synced, no feedback. | minor |
| /dashboard/youtube | Redirects to /dashboard (the sidebar marks it "Soon"). Fine. | none |
| /dashboard/settings/modules | 404 live. It exists in the repo, so this is a version gap only. | n/a |
| Everything else | Sentiment, Content, Funnel, Opportunities, Competitive, Watchlist, Cultural, AI Visibility, Campaigns, Influencers, OOH, Offline Tracking, Page Audits, Radio, TV, Print, Creative Library, MMM, Geo-Lift, Budget, Loyalty, Advocacy, CDP, Methodology, Surveys, NPS, Panels, Pre-Post, Marketplace, Field Intel, Voice Builder and Create Ad all load with an empty state that names a next action. | ok |

**Product tour.**
- On first visit to a module, the tour opens automatically.
- On the dashboard it ran 6 steps, Next worked through to the end, and it did not come back after a reload.
- The topbar "Show me around" trigger reopened it and it completed again (`shots/tourtrigger-step*.png`).
- **Pages with no tour button (minor):** AI Visibility, Creative Library, Ask AI, Field Intelligence, Campaigns/new, OOH/new, Events/new, Create Ad, Drafts, WhatsApp contacts, E-commerce import, all Settings pages.
- "Seen" is stored only in localStorage (`src/components/tours/tour-trigger.tsx:34`), so tours replay on every new browser or device (minor).

### 4. Connectors (`/dashboard/connectors`)
Method: `conn.js`–`conn4.js`. Screenshot: `shots/connectors-full.png`. Each OAuth route was requested without following the redirect, and the flow stopped before any third-party login.

| Card | Redirect | Verdict |
|---|---|---|
| Instagram | `www.facebook.com/v21.0/dialog/oauth`, client_id present, redirect_uri `https://brandgauge.app/api/social/callback/instagram`, state present | well-formed |
| Facebook | Same app, redirect_uri `.../api/social/callback/facebook`, state present | well-formed |
| X (Twitter) | `x.com/i/oauth2/authorize`, client_id, redirect_uri on brandgauge.app, state, PKCE | well-formed |
| GA4 | `accounts.google.com/o/oauth2/v2/auth`, client_id, redirect_uri `.../api/connectors/ga4/callback`, state, `ga4_oauth_state` cookie set | well-formed; also asks for `analytics.manage.users.readonly`, which goes beyond the "read only" copy (minor) |
| Meta Ads | facebook oauth, redirect_uri `.../api/ads/meta/callback`, state | well-formed, but requests **`ads_management`** (write) while the copy says it only syncs performance (minor; needed for Create Ad, which should be explained) |
| Google Ads / TikTok Ads / HubSpot | Shown as "Coming soon" | ok |
| Mailchimp / Brevo / App Store | No validation; garbage shows Connected or Configured (#5) | serious |
| Google Play package | "saved for future integration" | ok |
| "Recommended for Fintech" | Lists Firebase and AppsFlyer, which have no card on the page (dead recommendation) | minor |

No card claimed "connected" wrongly on first load: 0/3 social connected, and GA4 and Meta not connected. The wrong "Connected" states appeared only after the invalid keys above.

### 5. Settings
- **Profile:** the name change saved ("Name updated."), persisted across reload, and was reverted. OK.
- **Brand:** a no-op save gave "Brand profile saved.". The FMCG `brand_type` was preselected even though Fintech was chosen (#2).
- **Competitors:** adding Moniepoint worked with a toast, and removal worked. OK.
- **Brands:** "beta plan supports unlimited brands", which contradicts Billing (#4).
- **Billing and Portal:** paywall (#4).
- **OOH Domain:** examples use a made-up slug, "bgaudittest-morelife", and a domain, "go.bgaudittest.com" (minor).
- **Field Teams:** copy says "Share the team link via WhatsApp or SMS". The product has no SMS by rule (minor copy).
- **Pixel:** loads.
- **Access:** "Nobody from BrandGauge has viewed this account". Loads.
- The password change was not exercised. Delete account was deliberately not touched.

### 6. Free tools (run as an anonymous visitor)
| Tool | Input | Result |
|---|---|---|
| Competitor Tracker #1 | kuda.com vs moniepoint.com | **Failed**: "The site refused our request"; no press fallback (#9). `shots/tool-ct.png` |
| Competitor Tracker #2 | kuda.com vs palmpay.com | **Good.** 3 moves in the last 30 days; the lead finding is a 2026-10-23 PalmPay cybersecurity partnership with its source. Evidence links are `news.google.com` redirect URLs rather than the publisher (minor). `shots/tool-ct2.png` |
| Brand Gap #1 | Kuda / kuda.com | My script closed the page during the "Researching" phase, so the result was not captured. The run was spent. |
| Brand Gap #2 | Kuda / kuda.com | Works and is specific, but the lead finding rests on 2024 evidence and the report has an HTML-entity leak (#8). `shots/tool-bg.png` |
| Campaign Audit | kuda.com | Works and is specific. The top finding is likely a false positive, the PageSpeed check did not run, and the env var name is exposed (#8). `shots/tool-ca.png` |
| Market Demand ×2 | kuda.com, "Digital banking app" (±palmpay.com) | **Not testable here.** Both runs got a 502 `upstream request failed` at exactly 30.07s, with no Vercel headers. That is this sandbox's egress proxy cutting long requests, not the site. Real finding: on any non-JSON error the page shows the raw parser error **"Unexpected token 'u', "upstream r"... is not valid JSON"** (`src/components/tools/market-demand-page.tsx:69` calls `r.json()` unguarded). A Vercel timeout would show the same thing. Minor or serious. |
| Scoreboard | Not run | Its lead form emails an internal alert (`src/app/api/scoreboard/lead/route.ts:95`), and the run budget was spent on the four tools. |
| Offline tracker | Page loads only | Creating a campaign mints a permanent slug, so it was not run. |

Gate behaviour: the email gate appears after one full finding, as designed. I did **not** submit the gates: each unlock emails the report and records a lead, and I kept emails to a minimum. The gate's single consent checkbox bundles "email me this report", "keep me updated" and "contact me about BrandGauge" into one agreement. That is worth checking against NDPR (minor).

### 7. The Desk
- `desk.brandgauge.app` → `/login?next=%2Fdesk` shows "STAFF ONLY", with no signup link and no OAuth button. Good.
- `/desk` on the main host returns 404, as designed. No login was attempted.
- The page names a person: "If you need it, ask Emmanuel". That is minor information exposure on a public login page.

---

## Could not test, and why
- **Market Demand Gap Finder output.** The sandbox proxy caps requests at about 30s. Both permitted runs were used.
- **Free-tool email unlock and full reports, scoreboard lead, survey send, WhatsApp send, invites.** The no-sending rule.
- **Any OAuth completion (Google, Meta, X), and so any populated dashboard, sync or data module.** By rule. Every data-dependent screen was seen empty only.
- **AI Visibility "Run check", Competitive briefing, MMM run, Funnel "Diagnose with AI".** Not clicked, to avoid AI and external-LLM spend on a fake brand.
- **Password reset email, change password, delete account.** Destructive, or would send email.
- **Desk beyond the login page.** By rule.
- **375px pass over the last ~20 links (mostly settings sub-pages).** It was still running when this was written. The 1280px pass covered all 63.
- **The Brand Gap #1 result.** Lost to a script timing bug, as noted above.

## Cleanup still needed
Mailchimp, Brevo and the Apple App ID on brand "BG Audit Test" hold `not-a-real-key`, and the UI has no way to remove them. Delete those rows in Supabase, or delete the whole test workspace when you are done.
