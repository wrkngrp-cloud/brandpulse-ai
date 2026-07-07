# Connector setup guide

Everything in this file is already built in the codebase. None of it needs new code — each one just needs a credential added to Vercel. Once you have the credential(s) listed under an item, tell Claude and it gets added to Vercel and goes live with no further code changes.

Current status of each, checked directly against `vercel env ls` and the actual code on 2026-07-07 — this list moves, so if it's been a while, ask Claude to re-verify before trusting it.

---

## 1. Google Ads

**What it unlocks:** Real ad spend, clicks, impressions, and conversions from Google Ads flowing automatically into commercial metrics (CAC, ROAS, etc.) on Board Pack and Business Case. Currently shows "Coming soon" in Settings → Connectors.

**What's missing:** A Google Ads **developer token**. This is separate from the `GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET` you already have — those handle login, the developer token handles actual API access to real ad data.

**Steps:**
1. Go to [ads.google.com/home/tools/manager-accounts](https://ads.google.com/home/tools/manager-accounts) and create a **Google Ads Manager account** (MCC) if you don't already have one. This is free and different from a regular ad account — it's the account that oversees your (or your clients') ad accounts.
2. Sign into the Manager account.
3. Click the wrench icon (**Tools & Settings**) → under "Setup" → **API Center**.
4. Apply for a developer token there. You'll be asked what you're building and how you'll use the data — describe it as pulling your own (or your clients') campaign performance data into a reporting dashboard.
5. You'll first get **Test account access** instantly — this only works with Google's sandbox test accounts, not real data, but is enough to prove the connector works.
6. For **Basic access** (real production data, with a request-rate cap), Google reviews your application — this can take a few days to a few weeks.
7. Once approved, copy the developer token (a long alphanumeric string) and give it to Claude.

**Env var needed:** `GOOGLE_ADS_DEVELOPER_TOKEN`

---

## 2. HubSpot

**What it unlocks:** Real marketing-qualified-lead (MQL) counts pulled from your HubSpot contact lifecycle stages, feeding the MQL and Cost Per Lead numbers. Read-only — never writes anything back to HubSpot. Currently shows "Coming soon" in Settings → Connectors.

**What's missing:** A HubSpot developer app hasn't been registered at all yet — no credentials exist for this one.

**Steps:**
1. Go to [developers.hubspot.com](https://developers.hubspot.com) and sign in (or create a free developer account).
2. Create a new **app** in the developer account (Apps → Create app).
3. Under the app's **Auth** tab, set the redirect URL to:
   `https://brandpulse-ai-tau.vercel.app/api/connectors/hubspot/callback`
4. Under **Scopes**, add `crm.objects.contacts.read` (read-only — that's all this connector ever asks for).
5. Copy the **Client ID** and **Client Secret** from the app's Auth tab and give both to Claude.

**Env vars needed:** `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`

---

## 3. TikTok Ads

**What it unlocks:** Campaign, ad group, and creative performance from TikTok Ads. Currently shows "Coming soon" in Settings → Connectors — the OAuth login routes exist in the code, but there's no data-sync job or dashboard page yet (this one needs a bit of new code too, not just a credential).

**What's missing:** TikTok Business API approval, plus the sync job and dashboard UI still need to be built (ask Claude to build these once you have API access).

**Steps:**
1. Go to [ads.tiktok.com/marketing_api](https://ads.tiktok.com/marketing_api) and apply for **TikTok for Business Marketing API access**. You'll need an active TikTok Ads account and to describe your use case (pulling your own campaign performance into a reporting dashboard).
2. TikTok reviews this manually — approval time varies, plan for a couple of weeks.
3. Once approved, TikTok gives you an **App ID** and **App Secret** in the TikTok for Business developer portal.
4. Give both to Claude, along with a note to finish building the sync job and dashboard page (the OAuth login part is already there).

**Env vars needed:** `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID` (exact names to confirm with Claude when you're ready — the connector isn't fully built yet, so these may change)

---

## 4. WhatsApp Deep Integration

**What it unlocks:** Sending WhatsApp campaign broadcasts, NPS surveys, and survey dispatch directly from BrandPulse, with delivery tracking and opt-out handling. Fully built in the code, just not visible in the nav yet (shows "Coming soon").

**What's missing:** A dedicated phone number registered as a WhatsApp Business Account (WABA) — not a number already active on regular WhatsApp or WhatsApp Business App.

**Steps:**
1. Get a new SIM card that has never been registered on WhatsApp or the WhatsApp Business app.
2. Go to [business.facebook.com](https://business.facebook.com) (Meta Business Manager) and register the number as a **WhatsApp Business Account (WABA)** under WhatsApp Manager.
3. Once verified, Meta gives you a **Phone Number ID**, a **WhatsApp Business Account ID**, and you'll generate a permanent **access token** for a system user (not a temporary token — those expire in 24 hours).
4. Give all three to Claude, plus the app secret from the same Meta app used for the WABA.

**Env vars needed:** `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`
*(`WHATSAPP_VERIFY_TOKEN` is already set — the webhook itself is already verified and working, it's just waiting on a real number.)*

---

## 5. YouTube Intelligence

**What it unlocks:** Video tracking by channel/keyword, view/like/comment analytics, and brand-mention detection in video titles and descriptions. The dashboard page and client code are fully built but the page currently redirects away — it shows "Coming soon" in the nav.

**What's missing:** A YouTube Data API v3 key.

**Steps:**
1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project (or reuse an existing one — you likely already have a Google Cloud project since GA4/Google Ads use the same underlying platform).
3. Go to **APIs & Services → Library**, search for **YouTube Data API v3**, and enable it.
4. Go to **APIs & Services → Credentials → Create Credentials → API key**.
5. (Recommended) Restrict the key to only the YouTube Data API v3, so it can't be misused for anything else if it ever leaks.
6. Give the key to Claude.

**Env var needed:** `YOUTUBE_API_KEY`

---

## 6. AI Visibility Tracker — this one is actually ready right now

**What it unlocks:** Weekly (and on-demand) checks of your brand's presence in ChatGPT, Gemini, and Perplexity answers — a 0–100 visibility score, a 12-week trend, and competitor surfacing.

**What's missing:** Nothing. `OPENAI_API_KEY` is already set in Vercel, and this feature only needs one of OpenAI/Google AI/Perplexity to work. It's marked "Coming soon" in the nav right now, but that's just because the nav entry was intentionally hidden during beta — the credential blocker is already gone.

**Steps:** Just tell Claude to turn this one on for real (remove the `comingSoon` flag on its nav entry) whenever you're ready — no external application or waiting required.

---

## 7. Geo-Lift search-uplift correlation (Google Trends)

**What it unlocks:** Correlating out-of-home campaign activity with Google Trends search interest, inside the existing (already-live) Geo-Lift page. This is a smaller sub-feature of a page that already works — not a separate connector card.

**What's missing:** A SerpAPI key. Already fails gracefully today with an inline message ("Add SERPAPI_KEY to enable Google Trends analysis") rather than breaking anything.

**Steps:**
1. Go to [serpapi.com](https://serpapi.com) and create an account.
2. Copy your API key from the dashboard.
3. Give it to Claude.

**Env var needed:** `SERPAPI_KEY`

---

## 8. Billing & Plans

**Not a credential gap — this one's paused by a deliberate product decision**, not waiting on any external application. Will use Paystack (not Stripe) once activated post-beta. No action needed here until you decide it's time to turn on billing.

---

## Quick reference — env vars still missing

| Env var | Unlocks |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads connector |
| `HUBSPOT_CLIENT_ID` + `HUBSPOT_CLIENT_SECRET` | HubSpot connector |
| `TIKTOK_ACCESS_TOKEN` + `TIKTOK_ADVERTISER_ID` | TikTok Ads (also needs more code) |
| `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_BUSINESS_ACCOUNT_ID` + `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_APP_SECRET` | WhatsApp |
| `YOUTUBE_API_KEY` | YouTube Intelligence |
| `SERPAPI_KEY` | Geo-Lift search-uplift correlation |
| *(none — already have what's needed)* | AI Visibility Tracker |
