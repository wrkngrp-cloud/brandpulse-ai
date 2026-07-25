# BrandGauge Go-Live Checklist

A plain-English, do-this-then-that checklist for three things:

- **Part A** — Move the app onto `brandgauge.app`.
- **Part B** — Get the BrandGauge app verified and approved on Meta and Google.
- **Part C** — Connector audit: what already works, what's a placeholder, and exactly what each one needs to go live.

Everything here was checked against the actual code on 2026-07-25. Paths and env-var
names are copied from the code, not guessed. When a step says "give this to Claude,"
it means the value goes into Vercel's environment variables — never paste secrets into
git, chat logs, or this file.

Legend: `[ ]` = to do. Replace the placeholder `brandgauge.app` only if you register a
different apex domain.

---

## Part A — Migrate to brandgauge.app (for dummies)

The app currently answers on `brandpulse-ai-tau.vercel.app`. Migration = pointing the
new domain at the same Vercel deployment, then updating every place that still says the
old address so logins, emails, tracking links and OAuth redirects all use the new name.

### A0. Before you touch anything

- [ ] Confirm you own `brandgauge.app` at a registrar (Namecheap, Google Domains,
      Cloudflare, etc.). If not, buy it first.
- [ ] Decide the canonical form: **`brandgauge.app`** (recommended) with `www.brandgauge.app`
      redirecting to it. Pick one and stay consistent everywhere below.
- [ ] Do this during a quiet window. Nothing here deletes data, but OAuth logins can be
      briefly broken between "changed the redirect URL" and "redeployed."

### A1. Point the domain at Vercel

- [ ] Vercel → the BrandGauge project → **Settings → Domains → Add**.
- [ ] Add `brandgauge.app` and `www.brandgauge.app`. Mark `brandgauge.app` as primary and
      set `www` to redirect to it.
- [ ] Vercel shows you the exact DNS records. At your registrar's DNS panel add them:
  - Apex `brandgauge.app`: an **A record** to Vercel's IP (Vercel shows it, currently
    `76.76.21.21`) — or the ALIAS/ANAME Vercel offers.
  - `www`: a **CNAME** to `cname.vercel-dns.com`.
- [ ] Wait for Vercel to show **Valid Configuration** and issue the SSL certificate
      (usually minutes, up to ~24h for DNS to propagate). Don't move on until the
      padlock works on `https://brandgauge.app`.

### A2. Set the environment variables in Vercel

Vercel → Settings → **Environment Variables** (set for **Production**, and Preview if you
want previews to work too):

- [ ] `APP_URL = https://brandgauge.app`  ← used server-side to build OAuth redirect URIs,
      email links, pixel/SDK URLs. **This is the single most important one.**
- [ ] `NEXT_PUBLIC_APP_URL = https://brandgauge.app`  ← used in the browser.
- [ ] `NEXT_PUBLIC_SHORT_DOMAIN` — only if you use a separate short domain for OOH vanity
      links. If you don't have one, leave it unset and links fall back to the main domain's
      `/go/<slug>` path, which is fine.
- [ ] Confirm the always-required core vars are present (see the **Core env vars** table at
      the end of Part C). The production build currently fails without `RESEND_API_KEY`, so
      that one is not optional.

### A3. Update Supabase Auth URLs

Login and Google sign-in break if Supabase doesn't know the new domain.

- [ ] Supabase → your project → **Authentication → URL Configuration**.
- [ ] **Site URL** = `https://brandgauge.app`.
- [ ] **Redirect URLs** allow-list — add:
  - `https://brandgauge.app/**`
  - `https://brandgauge.app/api/auth/callback` (the Google sign-in / email callback)
  - Keep the old `https://brandpulse-ai-tau.vercel.app/**` entry until migration is fully
    verified, then remove it.

### A4. Verify the email sending domain (Resend)

Emails (surveys, reports, invites) send through Resend. Right now they'll come from a
Resend test/old domain.

- [ ] Resend dashboard → **Domains → Add Domain** → `brandgauge.app`.
- [ ] Add the SPF + DKIM DNS records Resend gives you at your registrar.
- [ ] Wait for **Verified**.
- [ ] Make sure the "from" address used in the code (e.g. `hello@brandgauge.app`) is on the
      verified domain. `hello@brandgauge.app` is already the contact address on the landing
      page, so match it.

### A5. Fix the hardcoded old domain in the code

These files fall back to the **old** `brandpulse-ai-tau.vercel.app` when `APP_URL` isn't
set, or hardcode it outright. Setting `APP_URL` (A2) fixes the fallbacks at runtime, but
the literals should still be corrected so nothing silently points at the old site. Ask
Claude to update these to `https://brandgauge.app`:

Server routes (OAuth/webhook/email/pixel):
- [ ] `src/app/api/auth/meta/deauthorize/route.ts`
- [ ] `src/app/api/billing/checkout/route.ts`
- [ ] `src/app/api/billing/portal/route.ts`
- [ ] `src/app/api/surveys/[id]/send-whatsapp/route.ts` (also see the WhatsApp bug in Part C)
- [ ] `src/app/api/sdk/pixel/route.ts`
- [ ] `src/lib/inngest/functions/scheduled-reports.ts`
- [ ] `src/lib/inngest/functions/panel-dispatch.ts`

Dashboard pages / clients (OOH links, pixel snippet, portal, print, digital):
- [ ] `src/app/dashboard/ooh/new/page.tsx`
- [ ] `src/app/dashboard/ooh/[id]/edit/page.tsx`
- [ ] `src/app/dashboard/ooh/[id]/page.tsx`
- [ ] `src/app/dashboard/ooh/page.tsx`
- [ ] `src/app/dashboard/settings/pixel/pixel-settings-client.tsx`
- [ ] `src/app/dashboard/settings/ooh-domain/page.tsx`
- [ ] `src/app/dashboard/settings/portal/page.tsx`
- [ ] `src/app/dashboard/connectors/pixel-card.tsx`
- [ ] `src/app/dashboard/digital/page.tsx`
- [ ] `src/app/dashboard/surveys/[id]/actions.ts`
- [ ] `src/app/dashboard/print/page.tsx`

Docs:
- [ ] `docs/connector-setup-guide.md` (HubSpot redirect URL still shows the old domain)

> The safest change is to make each of these read `process.env.APP_URL` with a
> `https://brandgauge.app` fallback, rather than the old URL, so there's one source of truth.

### A6. Update every OAuth app's redirect URI

Each external platform stores an exact redirect URL. If it still says the old domain, that
login fails. Update them (full details in Part B):

- [ ] Meta app — Facebook Login, Instagram, Ads callbacks.
- [ ] Google Cloud OAuth client(s) — GA4 and Google Ads callbacks + Google sign-in via
      Supabase.
- [ ] HubSpot app (when you set it up).
- [ ] Any others you've already registered (Twitter/X, LinkedIn, TikTok).

### A7. Redeploy and drive the flows

- [ ] Trigger a fresh Vercel deploy so the new env vars and code land.
- [ ] Sign up with email on `https://brandgauge.app`, confirm the email link points at the
      new domain.
- [ ] Sign in with Google — confirm it returns to `brandgauge.app/dashboard`.
- [ ] Connect one social account (Instagram or X) and confirm the OAuth round-trip lands
      back on the new domain.
- [ ] Generate an OOH vanity link and a pixel snippet; confirm both show `brandgauge.app`.
- [ ] Send yourself a test survey email; confirm the from-address and links.

### A8. Cleanup

- [ ] Leave the old `*.vercel.app` URL working for a week (Vercel keeps it) so nothing
      breaks mid-migration.
- [ ] Once verified, remove the old domain from Supabase redirect allow-list and from any
      OAuth apps.
- [ ] Add a `.env.example` file (it doesn't exist yet) listing every variable name with
      blank values, so the next person can set up a new environment without spelunking the
      code. Ask Claude to generate it from the code.

---

## Part B — Meta & Google verification and approval

Both platforms work the same way: you register **one app** per platform, prove **who owns
the business**, then request **approval for each permission (scope)** that touches user or
ad data. Basic/login scopes work immediately; the money scopes (ads, insights, WhatsApp,
Analytics) need review.

### B1. Meta — one Business app for Facebook, Instagram, Ads, and WhatsApp

The code uses one Meta app across four products: `META_APP_ID` / `META_APP_SECRET` for
Facebook Login + Instagram + Ads, and `WHATSAPP_*` for WhatsApp. Register them under a
single Meta app if you can — it's less review overhead.

**B1a. Create the app and business**
- [ ] Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App**
      → type **Business**.
- [ ] Name it "BrandGauge". Link it to a **Meta Business Portfolio** (create one at
      [business.facebook.com](https://business.facebook.com) if you don't have one).

**B1b. Business Verification (do this early — it gates everything)**
- [ ] Meta Business Settings → **Security Center → Start Verification**.
- [ ] Provide: legal business name, address, phone, and a document (CAC certificate,
      utility bill, or bank statement matching the business name).
- [ ] This can take a few days. Advanced Access to scopes is not granted until this passes.

**B1c. Add products and set redirect URIs**
- [ ] Add **Facebook Login** product. Under its Settings → **Valid OAuth Redirect URIs**, add:
  - `https://brandgauge.app/api/social/callback/facebook`
  - `https://brandgauge.app/api/social/callback/instagram`
- [ ] Add **Instagram** (Instagram Graph API / Instagram Basic Display as applicable).
- [ ] Add **Marketing API** (Ads). Redirect URI:
  - `https://brandgauge.app/api/ads/meta/callback`
- [ ] Add **WhatsApp**. Configure the webhook:
  - Callback URL: `https://brandgauge.app/api/whatsapp/webhook`
  - Verify token: the value of `WHATSAPP_VERIFY_TOKEN` (already set in Vercel).
  - Subscribe to the `messages` webhook field.

**B1d. App settings pages Meta requires before review**
- [ ] App Settings → Basic:
  - Privacy Policy URL: `https://brandgauge.app/privacy-policy` (page already exists).
  - Terms of Service URL: add one if you have it.
  - App icon (1024×1024), category, business email.
  - **Data Deletion**: set either a Data Deletion Callback URL or a "Data Deletion
    Instructions URL." The app has a deauthorize callback at
    `https://brandgauge.app/api/auth/meta/deauthorize`, but that is not the same as a data
    deletion endpoint. **Gap to close:** either point the Instructions URL at a section of
    the privacy policy that explains how to request deletion, or ask Claude to add a proper
    `/api/auth/meta/data-deletion` callback. Meta will not approve without one.

**B1e. Request the scopes (App Review → Permissions and Features)**
Request Advanced Access for exactly these, because the code asks for them:
- [ ] Facebook/Instagram (social listening): `pages_show_list`, `pages_read_engagement`,
      `instagram_basic`, `instagram_manage_insights` (`public_profile` is default access).
- [ ] Ads (Meta Ads connector): `ads_read`, `ads_management`, `read_insights`.
- [ ] WhatsApp: `whatsapp_business_messaging`, `whatsapp_business_management`.
- [ ] For each, record a **screencast** showing a real user connecting that feature in
      BrandGauge and the data appearing. Meta reviewers reject vague submissions — show the
      exact click path from Settings → Connectors.
- [ ] Explain each permission in one honest sentence ("We read the brand's own Instagram
      insights to compute their Brand Health Index").

**B1f. WhatsApp number (Model A)**
- [ ] Get a brand-new SIM never used on WhatsApp or WhatsApp Business.
- [ ] In WhatsApp Manager, register it as a WhatsApp Business Account (WABA).
- [ ] Generate a **permanent system-user access token** (not the 24-hour temporary one).
- [ ] Collect `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`,
      `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` → give to Claude for Vercel.
- [ ] Submit your message templates for Meta approval before sending (the code requires
      approved templates).

**B1g. Go live**
- [ ] Flip the app from **Development** to **Live** (top toggle) once review passes.

### B2. Google — Cloud project, OAuth consent, and verification

The code uses Google in four ways: Google sign-in (via Supabase), GA4
(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), Google Ads (`GOOGLE_ADS_CLIENT_ID`/`SECRET`
+ developer token), and API keys for YouTube and Maps. One Cloud project can hold all of it.

**B2a. Project + APIs**
- [ ] [console.cloud.google.com](https://console.cloud.google.com) → create/select project
      "BrandGauge".
- [ ] APIs & Services → **Library** → enable: **Google Analytics Data API**, **Google Ads
      API**, **YouTube Data API v3**, and the **Maps/Places API** you use for venues.

**B2b. OAuth consent screen (this is "the app" Google verifies)**
- [ ] APIs & Services → **OAuth consent screen** → User type **External**.
- [ ] App name "BrandGauge", support email, app logo.
- [ ] **Authorized domains:** `brandgauge.app`.
- [ ] App homepage: `https://brandgauge.app`. Privacy policy: `https://brandgauge.app/privacy-policy`.
- [ ] Add the scopes the code requests:
  - GA4: `https://www.googleapis.com/auth/analytics.readonly` (sensitive scope).
  - Google Ads: `https://www.googleapis.com/auth/adwords` (sensitive scope).
  - Sign-in: `openid`, `email`, `profile` (non-sensitive).
- [ ] Because `analytics.readonly` and `adwords` are **sensitive scopes**, Google requires
      **app verification**: submit for verification from the consent screen, provide a
      demo video, and justify each scope. Budget 1–4 weeks. Until verified you can add up
      to 100 **test users** and everything works for them.

**B2c. OAuth client (redirect URIs)**
- [ ] APIs & Services → **Credentials → Create Credentials → OAuth client ID → Web application**.
- [ ] **Authorized JavaScript origins:** `https://brandgauge.app`.
- [ ] **Authorized redirect URIs** — add all of these (they're taken from the code):
  - `https://brandgauge.app/api/connectors/ga4/callback`
  - `https://brandgauge.app/api/ads/google/callback`
  - `https://brandgauge.app/api/ads/google-ads/callback`
- [ ] For **Google sign-in**, the redirect is Supabase's, not yours. In Supabase →
      Authentication → Providers → Google, paste this OAuth client's ID + secret, and copy
      Supabase's callback (`https://<your-project-ref>.supabase.co/auth/v1/callback`) into
      this Google client's Authorized redirect URIs as well.

**B2d. Google Ads developer token**
- [ ] [ads.google.com](https://ads.google.com) → create a **Manager (MCC) account** (free).
- [ ] Tools & Settings → **API Center** → apply for a **developer token**.
- [ ] Test access is instant (sandbox only); **Basic access** (real data) is a manual
      review, days to weeks.
- [ ] Give `GOOGLE_ADS_DEVELOPER_TOKEN` to Claude when approved.

**B2e. API keys (no OAuth review needed)**
- [ ] YouTube Data API v3 key — restrict it to that API. (Note: the code stores the YouTube
      key **per-brand, pasted and encrypted in the DB** via the connector UI, not as a
      global env var — so this key is entered in-app, not in Vercel.)
- [ ] `GOOGLE_MAPS_API_KEY` — for venue/places lookups; restrict to the Maps/Places APIs.
- [ ] `NEXT_PUBLIC_MAPBOX_TOKEN` — the OOH map uses Mapbox, not Google Maps. Separate
      account at [mapbox.com](https://mapbox.com); this one is public (browser-side) so
      restrict it by URL to `brandgauge.app`.

---

## Part C — Connector audit (what's real vs placeholder)

Status key:
- **LIVE** — works today once the user connects/pastes a key in-app; no code or platform
  approval blocking it.
- **NEEDS PLATFORM APPROVAL** — code is complete and wired, but the Meta/Google review in
  Part B must pass first.
- **PLACEHOLDER** — shows "Coming soon" in the UI and/or is missing a credential; may also
  need code.
- **BROKEN / INCONSISTENT** — actively wrong in the code; must be fixed for a
  "fully functional" claim.

### C1. Working connectors (self-serve, no blocker)

| Connector | How it connects | Notes |
|---|---|---|
| Paystack | Pasted secret key + webhook | Live. Webhook signature verified (HMAC sha512). |
| Flutterwave | Pasted secret + webhook | Live. |
| Mailchimp | Pasted API key | Live; feeds Loyalty funnel. |
| Brevo | Pasted API key | Live. |
| Apple App Store reviews | App Store ID | Live; syncs Sundays. |
| E-commerce (Jumia/Konga) | CSV / sales import | Live. |
| Website & App Pixel | Self-serve snippet | Live; URL must show `brandgauge.app` after Part A. |
| AI Visibility (ChatGPT/Gemini/Perplexity) | `OPENAI_API_KEY` (already set) | **Ready now** — only hidden by a `comingSoon` nav flag. Ask Claude to unhide it. |

### C2. Built and wired, but blocked on Meta/Google approval (Part B)

| Connector | Env / scope needed | Blocker |
|---|---|---|
| Instagram (social listening) | `META_APP_ID`/`META_APP_SECRET`, IG scopes | Meta App Review (B1e) + Business Verification. |
| X / Twitter (social listening) | `TWITTER_CLIENT_ID`/`TWITTER_CLIENT_SECRET` | Needs a Twitter/X developer app + OAuth2 creds. Free-tier @mentions only. |
| Meta Ads | `META_APP_ID`/`META_APP_SECRET`, `ads_*` scopes | Meta App Review. |
| GA4 (Web Analytics) | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `analytics.readonly` | Google OAuth verification (B2b). Works for test users meanwhile. |

### C3. Placeholders — "Coming soon" in the UI

| Connector | What's missing | Code state |
|---|---|---|
| Google Ads | `GOOGLE_ADS_DEVELOPER_TOKEN` (B2d) | Fully built; only the token is missing. |
| HubSpot | `HUBSPOT_CLIENT_ID` + `HUBSPOT_CLIENT_SECRET` | Fully built; register a HubSpot app, scope `crm.objects.contacts.read`, redirect `https://brandgauge.app/api/connectors/hubspot/callback`. |
| TikTok Ads | `TIKTOK_ADS_APP_ID` + `TIKTOK_ADS_SECRET` **and code** | OAuth login routes exist; **no sync job or dashboard UI yet.** Needs both approval and new code. |
| WhatsApp (broadcasts/NPS) | WABA number + `WHATSAPP_*` tokens (B1f) | Fully built; connector card + nav hidden until a number is live. |
| YouTube Intelligence | YouTube Data API key (pasted in-app, encrypted) | Dashboard + client built; page currently routes to "Coming soon." |
| Geo-Lift ↔ Google Trends | `SERPAPI_KEY` | Sub-feature of the live Geo-Lift page; fails gracefully with an inline "Add SERPAPI_KEY" message today. |
| Google Maps venue sync | `GOOGLE_MAPS_API_KEY` | Skips gracefully when unset. |
| OOH map (Mapbox) | `NEXT_PUBLIC_MAPBOX_TOKEN` | Map won't render without it. |
| LinkedIn Ads | `LINKEDIN_ADS_CLIENT_ID`/`SECRET` | OAuth routes exist; not surfaced on the Connectors page. Confirm scope of intent with Claude before promising it. |
| Twitter Ads | `TWITTER_ADS_API_KEY`/`SECRET` | OAuth routes exist; not surfaced on the Connectors page. |
| Billing & Plans | — (deliberate) | Paused by product decision; will use Paystack post-beta. Stripe code exists but is unconfigured. Not a bug. |

### C4. Broken / inconsistent — fix these for a truly functional app

- [ ] **WhatsApp survey dispatch still uses Africa's Talking.**
      `src/app/api/surveys/[id]/send-whatsapp/route.ts` requires `AFRICAS_TALKING_API_KEY`
      and parses an Africa's Talking response — but `CLAUDE.md` says that path was removed
      on 2026-07-11 and WhatsApp is Meta Cloud (Model A) only. This route is dead and will
      mislead anyone wiring WhatsApp. **Fix:** rewire it to the Model A sender
      (`/api/whatsapp/send` / the WhatsApp Inngest job) or remove it and point survey
      WhatsApp dispatch at the Model A path. Ask Claude to do this.
- [ ] **Google Play reviews are a placeholder.**
      `src/lib/inngest/functions/app-review-sync.ts` has an explicit "Google Play
      placeholder" step (Step 2b). Apple reviews sync; Google Play does not. Either build
      the Google Play fetch or label it clearly as Apple-only in the UI.
- [ ] **18 files hardcode the old domain** (listed in A5). Fix during migration.
- [ ] **No `.env.example`.** Add one so nobody has to reverse-engineer required vars.
- [ ] **`connector-setup-guide.md` points HubSpot at the old domain** and lists a
      `YOUTUBE_API_KEY` env var the code doesn't read (YouTube key is pasted per-brand).
      Reconcile that doc with this audit.

### C5. Core env vars — the app is not "fully functional" without these

Set every one of these in Vercel Production. These are not features; they're the engine.

| Env var | Why it's core |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Database + auth (client). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side privileged DB access (webhooks, jobs, public endpoints). |
| `ANTHROPIC_API_KEY` | Every BrandGauge AI feature (BHI narrative, reports, sentiment, chat). |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | Correct OAuth redirects, email links, pixel URLs (Part A). |
| `TOKEN_ENCRYPTION_KEY` | Encrypts stored OAuth/connector tokens. Required in production. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiting, OAuth state, caching. |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | All background jobs (syncs, crawls, sends). |
| `RESEND_API_KEY` | Email. **The production build currently fails without it.** |
| `ADMIN_SECRET` | Gates seed/admin endpoints (fail-closed if unset). |

Feature env vars (the connector-specific ones in C2/C3) are additive: the app runs without
them, those specific connectors just stay "Coming soon."

---

## Suggested order of operations

1. **Part A** first (domain + core env vars + Supabase URLs) — nothing else can be tested
   on the real domain until this is done.
2. Fix the **C4 code issues** (Africa's Talking route, old-domain literals, `.env.example`)
   in the same pass, since they're small and block a clean launch.
3. Kick off **Business Verification** on Meta (B1b) and **OAuth verification** on Google
   (B2b) immediately — they run in the background for days/weeks while you do everything else.
4. Turn on the **zero-approval wins**: AI Visibility (already ready), Mapbox token, Maps
   key, SerpAPI key, plus any pasted-key connectors (Paystack, Mailchimp, etc.).
5. As each platform approval lands, drop the credential into Vercel and unhide the
   connector.
