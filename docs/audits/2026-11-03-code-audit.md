# BrandGauge integration audit (read-only)

Repo: /home/user/brandpulse-ai at commit 13ace02 (3 Nov 2026). This was a code audit only: nothing was edited or committed, and no live API was called. The status labels mean:

- **Broken (code proves it)**: the failure follows from the code and the schema alone, or from the code plus a documented platform rule that is named in the finding.
- **Likely broken**: the failure depends on how an external API behaves today. The note says what to check.
- **Inert (missing credential)**: the code is complete and waits on an env var or an app review.

Effort: small = under half a day, medium = 1 to 2 days, large = more than that.

## Offline checks that were run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass (exit 0) |
| `npm run tools:check` | PASS, 312 checks |
| `npm run desk:check` | PASS, 37 checks |
| `npm run metrics:check` | PASS, 39 checks |
| `npm run seeds:check` | PASS, 0 unknown tables or columns |
| `npm run demo:check` | PASS |

All of these pass, yet none of them covers the job and connector paths below. I also ran three ad-hoc scripts over `supabase/migrations` and `src`:
- `onConflict` targets matched against unique constraints and indexes.
- Literal values written to columns with a CHECK constraint.
- Columns named in `.insert/.upsert/.update/.select` matched against the columns the migrations create.

Their hits are confirmed by hand below.

---

## Top 10, ranked by damage to a real brand's onboarding

| # | Finding | Status | Effort |
|---|---|---|---|
| 1 | Survey invitations, one-off and panel, put up to 50 recipients in one `To:` header. Every respondent sees 49 other people's email addresses. This is an NDPR exposure on the first survey a brand sends. | Broken (code proves it) | small |
| 2 | X (Twitter) stops syncing from the second night. The 03:00 post sync refreshes the token every run and throws away X's rotated refresh token, so every refresh after the first fails. The 04:00 mention crawl then fails as well. | Broken (code proves it) | small |
| 3 | Survey panels never go out. The insert uses `status: 'active'`, which `surveys.status` CHECK rejects. Even with that fixed, the public page only serves `'live'`, and the panel survey is created with no questions. | Broken (code proves it) | small |
| 4 | A Google sign-in user who belongs to more than one workspace gets a new empty workspace and brand on every login. `.maybeSingle()` errors on 2+ rows, so the code thinks the user is new. This hits agencies and anyone invited. | Broken (code proves it) | small |
| 5 | The Meta data-deletion callback never records anything: the `void supabase...insert()` never runs. The status URL it hands Meta also points at a page that does not exist. Meta App Review needs this callback to work, and until review passes, Meta Ads, Instagram and Facebook only work for app testers. | Broken (code proves it) | small |
| 6 | The GA4 daily sync writes nothing. Its `upsert` uses `onConflict: 'brand_id,event_type'` on `sdk_events`, which has no such constraint, and the request lacks `metricAggregations`, so totals come back empty. It still stamps `last_synced_at`, so the Desk sees a healthy sync. Separately, no module reads the GA4 numbers at all. | Broken (code proves it) | small, plus medium to surface the data |
| 7 | Meta Ads: every row is labelled NGN even when the ad account bills in USD (common in Nigeria), so spend is off by roughly 1,500x. The 60-day token "refresh" is unreliable, and the card keeps saying Connected after the sync starts failing. | Broken (currency, code proves it) / Likely broken (refresh) | small to medium |
| 8 | Instagram and Facebook: the code silently picks the first Page the login manages, which is often the wrong brand for an agency. Nothing tracks or refreshes token expiry. The IG insights call asks for metrics Meta has retired, so reach and impressions come back as 0. Every fetch failure returns `[]`, so a dead connection looks like a quiet week. | Likely broken | medium |
| 9 | X Ads is offered as available on the Digital page. Connecting works and a banner says "Data will appear after tonight's sync", but no X Ads sync job exists. LinkedIn and TikTok are in the same state but hidden. | Broken (code proves it) | small to hide, large to build |
| 10 | In a multi-brand workspace, the Connectors and Settings pages read `social_connections` with no brand filter, so a brand shows another brand's X or Instagram as connected. Settings also shows a pending shared GA4 request as connected. | Broken (code proves it) | small |

---

## 1. Social connectors (X, Instagram, Facebook)

### 1.1 X refresh token thrown away after the first refresh
- **Status:** Broken (code proves it). X OAuth 2.0 refresh tokens are single-use and rotate; that is documented by X.
- **Where:** `src/lib/inngest/functions/sync-social-posts.ts:113-122`.
  - It refreshes on every run whenever a `refresh_token` exists.
  - It stores only `access_token` (line 120) and never `refreshed.refresh_token`.
  - Contrast `src/lib/crawl/run-crawl.ts:100-105`, which does persist the rotated token.
- **What the user sees:**
  - Night 1: the 03:00 job uses refresh token R1 and gets back A2 and R2. Only A2 is saved, and R1 is now dead.
  - Night 2: the 03:00 refresh with R1 fails. `fetchTwitterPosts` then returns `[]` on the expired token (`twitter.ts:295`).
  - The 04:00 crawl gets a 401, refreshes with R1, throws, and records a Twitter error.
  - From day 2 onward, X posts and mentions stop. The connection still reads "active".
- **Fix:** Refresh only when the token is expired (store `token_expiry`, which X returns as `expires_in`), and always persist the returned `refresh_token`. Put the refresh in one helper shared by both jobs. On failure, set `sync_status='error'` so the card offers Reconnect.
- **Effort:** small.

### 1.2 Parallel X refreshes race
- **Status:** Likely broken.
- **Where:** `src/lib/crawl/run-crawl.ts:118-127`. Two `withRefresh` calls run in `Promise.all`. When both get a 401, both refresh with the same refresh token, and the second refresh fails because the token has already rotated.
- **What the user sees:** Intermittent "X mentions failed" after a token expiry.
- **Fix:** Refresh once before the parallel calls, or memoise the refresh promise.
- **Effort:** small.

### 1.3 No token expiry or refresh for Instagram or Facebook
- **Status:** Likely broken. Meta long-lived user tokens last about 60 days; that is documented.
- **Where:**
  - `src/app/api/social/callback/[platform]/route.ts:136-183` stores the long-lived user token for Instagram and stores no `token_expiry`. `social_connections` has no expiry column.
  - Nothing refreshes it.
  - `fetchInstagramPosts` (`src/lib/social/meta.ts:63`), `fetchFacebookPosts` (`meta.ts:~102`) and the hashtag and tag fetchers (`src/lib/social/instagram.ts:46,103,146`) all `return []` on any non-OK response.
- **What the user sees:** About two months after connecting, Instagram goes silent. Sentiment and share of voice drift down as if conversation had dropped, and the card still says active.
- **Fix:** Store `expires_in`. Re-exchange the token in a daily job while it is still valid. Treat 190 / OAuthException as `sync_status='error'` and prompt to reconnect. Have the fetchers throw rather than return `[]` on auth errors.
- **Effort:** medium.

### 1.4 First Page wins
- **Status:** Likely broken for any login that manages more than one Page.
- **Where:** `src/app/api/social/callback/[platform]/route.ts:70` (`pagesData.data?.[0]`) and `:149` (`pages[0]`).
- **What the user sees:** An agency user, or a marketer who manages several brands, connects the wrong brand's Page and Instagram account without being told. Every sentiment, post and share-of-voice number then belongs to someone else.
- **Fix:** When more than one Page comes back, stash the token in Redis (as `ig-pending` already does) and show a picker.
- **Effort:** medium.

### 1.5 Retired Instagram insight metrics
- **Status:** Likely broken. Meta retired `impressions` and `video_views` for IG media insights in 2025.
- **Where:** `src/lib/social/meta.ts:70` requests `metric=impressions,reach,saved,video_views`. One invalid metric fails the whole call, and `insightRes.ok` false then maps every metric to 0.
- **What the user sees:** Instagram post reach and impressions show 0, and engagement rate is 0 (`sync-social-posts.ts:66` divides by reach).
- **Fix:** Request `reach,saved,views` (or `reach,saved,total_interactions`) and handle per-metric errors.
- **Effort:** small.

### 1.6 Upsert errors in the OAuth callback are ignored
- **Status:** Broken (code proves it).
- **Where:**
  - `src/app/api/social/callback/[platform]/route.ts:74,86,136,175,192`: each `upsert` result is discarded and the route redirects to `?connected=...` regardless.
  - The same applies to `src/app/api/social/instagram/finish-connect/route.ts:65`.
- **What the user sees:** "Connected" with no row saved, for example when `TOKEN_ENCRYPTION_KEY` is wrong.
- **Fix:** Check `error` and redirect with `?error=db_error`.
- **Effort:** small.

### 1.7 Connectors and Settings pages show other brands' connections
- **Status:** Broken (code proves it).
- **Where:**
  - `src/app/dashboard/connectors/page.tsx:34-36`.
  - `src/app/dashboard/settings/connections/page.tsx:13-15`.
  - Both select `social_connections` with no `.eq('brand_id', ...)`, so RLS returns every brand in the workspace.
- **What the user sees:** Brand B shows "X connected" because Brand A connected X.
- **Fix:** Add `.eq('brand_id', brand.id)`.
- **Effort:** small.

### 1.8 Wrong "free tier" copy for X
- **Status:** Broken (copy).
- **Where:** `src/app/dashboard/connectors/page.tsx:289` says "X captures direct @mentions via the free-tier user-context API. No paid bearer token needed." The code itself handles `X_CREDITS_DEPLETED` (`twitter.ts:181`), and CLAUDE.md says real calls cost X credit.
- **What the user sees:** A promise that X listening is free, followed by silence when the credit runs out.
- **Fix:** Reword the copy, and surface `X_CREDITS_DEPLETED` on the card.
- **Effort:** small.

### 1.9 Instagram hashtag quota
- **Status:** Likely broken for brands with many competitors or aliases.
- **Where:**
  - `run-crawl.ts` derives 2 hashtags per brand plus every custom hashtag and alias.
  - `crawl-competitors.ts:63-71` derives 2 more per competitor.
  - All of them run on the brand's own IG account, which has a 30-unique-hashtags-per-7-days limit.
- **What the user sees:** Once the quota is spent, `ig_hashtag_search` fails and returns `[]` silently.
- **Fix:** Count unique hashtags per IG account per week and cap or prioritise them. Log quota errors.
- **Effort:** small.

---

## 2. Paid media (Meta Ads, Google Ads, X / LinkedIn / TikTok Ads)

### 2.1 Meta spend labelled NGN whatever the account currency
- **Status:** Broken (code proves it).
- **Where:**
  - `src/lib/inngest/functions/meta-ads-daily-sync.ts:260` writes `currency: 'NGN'` on every row.
  - Meta reports spend in the ad account's currency, and the callback stores that currency (`src/app/api/ads/meta/callback/route.ts:112,134`).
  - The Google Ads sync does the same (`google-ads-daily-sync.ts:236`).
- **What the user sees:** A USD-billed account showing $1,200 renders as ₦1,200. ROAS, CPA, budget pacing and the media mix model are all wrong.
- **Fix:** Select `currency` with the account and write it. Convert in the read layer if the dashboard needs one currency.
- **Effort:** small.

### 2.2 Meta token "refresh" and silent upsert failure
- **Status:** Likely broken.
- **Where:**
  - `meta-ads-daily-sync.ts:113-133` passes the current long-lived token to `fb_exchange_token`. That does not reliably extend a token, and `expires_in` may be absent, in which case `new Date(NaN).toISOString()` throws inside the try block and the error is only logged.
  - When the 60-day token expires, insights return error 190 and the row goes to `sync_status='error'`.
  - The upsert failure path at lines 272-275 returns without setting `sync_status`/`last_error`, so a DB failure looks like a sync that simply has not run yet.
- **What the user sees:** Paid media data stops after about 60 days.
- **Fix:** Track expiry. Email the owner and show Reconnect 7 days before expiry, since a user token cannot be extended without the user. Record upsert errors in `last_error`.
- **Effort:** medium.

### 2.3 Meta Ads card ignores the sync status
- **Status:** Broken (code proves it).
- **Where:** `src/components/dashboard/meta-ads-connect-card.tsx` takes `sync_status` (line 14) but never renders it or `last_error`. It shows Connected whenever a row exists.
- **What the user sees:** The card says Connected while every nightly sync fails.
- **Fix:** Render the error state and `last_error` with a Reconnect button, the way `social-connect-card.tsx:107` does.
- **Effort:** small.

### 2.4 First Meta ad account wins
- **Status:** Likely broken.
- **Where:**
  - `src/app/api/ads/meta/callback/route.ts:107-115` takes the first active ad account.
  - With none, it stores account id `user-xxxx` and `ad_account_id: null`, then still redirects `connected=meta`. The sync then skips it forever (`meta-ads-daily-sync.ts:136-139`).
- **What the user sees:** The wrong ad account, or Connected with no data ever arriving.
- **Fix:** Add an account picker. Refuse to connect when there is no ad account.
- **Effort:** medium.

### 2.5 Meta insights paging and duplicate rows
- **Status:** Likely broken for larger accounts.
- **Where:**
  - `meta-ads-daily-sync.ts:165` sets `limit=500` and ignores `paging.next`. Seven days × ad sets over 500 are truncated.
  - The table's unique key (`20260625000000_digital_ads.sql:56`) includes the nullable `adset_id`/`campaign_id`. Nulls never conflict, so any row with a null id duplicates on every run.
- **What the user sees:** Missing ad sets, or inflated spend.
- **Fix:** Follow `paging.next`. Make the unique key `NULLS NOT DISTINCT` or coalesce the ids to `''`.
- **Effort:** small.

### 2.6 Google Ads pinned to API v17
- **Status:** Likely broken. Google sunsets Ads API versions on a published schedule and does not auto-upgrade them; v17 sunset in mid-2025.
- **Where:** `src/app/api/ads/google-ads/callback/route.ts:11` and `src/lib/inngest/functions/google-ads-daily-sync.ts:6` (`googleads.googleapis.com/v17`).
- **What the user sees:** Once the credentials are set, connect fails with `account_list_failed`, or the sync errors every night.
- **Fix:** Move to a supported version (v21 or later). Re-check the field names in the GAQL query.
- **Effort:** small.

### 2.7 Google Ads manager accounts
- **Status:** Likely broken.
- **Where:**
  - `google-ads/callback/route.ts:119-126` takes `resourceNames[0]`, which is often a manager (MCC) account.
  - The sync (`google-ads-daily-sync.ts:153-163`) sends no `login-customer-id` header.
- **What the user sees:** Metrics requests against a manager account fail. Client accounts reached through an MCC fail with a permission error.
- **Fix:** List the accounts with `customer_client`, let the user pick a client account, and send `login-customer-id` when access goes through a manager.
- **Effort:** medium.

### 2.8 Google Ads sync crashes on shared rows
- **Status:** Broken (code proves it) if a shared Google row ever exists.
- **Where:** `google-ads-daily-sync.ts:86` calls `decrypt(account.access_token)` without checking `auth_mode`. The shared-access migration made `access_token` nullable. Meta handles this (`meta-ads-daily-sync.ts:93-104`); Google does not.
- **What the user sees:** Nothing today, since the shared-access route only accepts ga4 and meta. It becomes a crash the day Google Ads sharing is added.
- **Fix:** Skip rows that are not OAuth, or route them through a service token.
- **Effort:** small.

### 2.9 X Ads offered with no sync behind it
- **Status:** Broken (code proves it).
- **Where:** `src/app/dashboard/digital/page.tsx:386` marks X `available: true`, and `:551` promises "Data will appear after tonight's sync at 5 AM". No Inngest function syncs `platform='twitter'` ad accounts (all 35 registered functions checked). LinkedIn and TikTok are `available: false`, but their callbacks also store accounts nothing syncs.
- **What the user sees:** "Connected", then no data ever.
- **Fix:** Set X to `available: false` until a sync exists.
- **Effort:** small (hide) / large (build three ad-platform syncs).

### 2.10 Ads connect routes redirect to a missing login page
- **Status:** Broken (code proves it).
- **Where:** `src/app/api/ads/{linkedin,tiktok,twitter}/connect/route.ts:24/28` redirect unauthenticated users to `/login`. The login page is `/auth/login`; there is no `src/app/login`.
- **What the user sees:** A 404 after the session expires.
- **Fix:** Use `/auth/login`.
- **Effort:** small.

### 2.11 OOH "Sync to Meta Ads" pushes nothing
- **Status:** Broken (code proves it).
- **Where:**
  - `src/components/ooh/geo-attribution-panel.tsx:131` says "click Sync to push to Meta Ads / Google Ads".
  - `src/app/api/ooh/geo-audiences/[id]/sync/route.ts:79-116` only calls `reachestimate`, marks the audience `active`, and stores a made-up `external_audience_id` of `geo:lat,lng`. No audience or saved targeting is created in Meta.
  - Google is rejected outright (line 31).
  - Line 51 calls `decrypt(adAccount.access_token)`, which crashes for a shared Meta row whose token is null, and `.single()` (line 41) errors when a brand has two Meta rows.
- **What the user sees:** An audience marked active in BrandGauge that does not exist in Ads Manager.
- **Fix:** Create a saved audience (`/act_x/saved_audiences`), or relabel the action "Estimate reach". Handle shared rows with the system token.
- **Effort:** medium.

### 2.12 Small Paid Media copy issues
- **Status:** Broken (copy).
- **Where:**
  - `connectors/page.tsx:293` says Meta Ads syncs at 6 AM; the cron is 5 AM (`meta-ads-daily-sync.ts:52`).
  - The Google callback redirects `connected=google_ads`, so the banner reads "google_ads Ads connected" (`digital/page.tsx:551`).
- **Effort:** small.

---

## 3. GA4

### 3.1 The daily sync writes nothing
- **Status:** Broken (code proves it).
- **Where:** `src/lib/inngest/functions/ga4-daily-sync.ts`.
  - Lines 97-108: `upsert(..., { onConflict: 'brand_id,event_type' })` on `sdk_events`. That table has only a primary key on `id` (`20260624003000_sdk_events.sql`), so Postgres refuses the statement with "no unique or exclusion constraint". The result is not checked.
  - Lines 68-76: the request omits `metricAggregations: ['TOTAL']`, which CLAUDE.md says is required for `totals[]`, so sessions would read 0 anyway.
  - Lines 110-115: `last_synced_at` is stamped and `processed++` runs regardless.
- **What the user sees:** Nothing changes for the user, but the Desk stale-sync check (`src/lib/desk/ops.ts` SYNC_TABLES) believes GA4 is healthy.
- **Fix:** Add `metricAggregations`. Insert a dated row instead of upserting, or add a dated unique key such as `(brand_id, event_type, occurred_on)`. Check the error before stamping.
- **Effort:** small.

### 3.2 No module reads the GA4 numbers
- **Status:** Broken (half-wired).
- **Where:**
  - The `ga4_sessions` rows are read by nothing. A grep finds only the writers.
  - `src/app/dashboard/page.tsx:56` and the funnel use `ga4_connections` only as a "connected" flag.
  - `mmm/run/route.ts:130` reads `sdk_events` but only counts purchase, lead, signup and conversion events.
- **What the user sees:** A connected GA4 changes no number in the product apart from the Sync now toast.
- **Fix:** Feed sessions and key events into the Consideration stage of the funnel and the BHI behind `brand_type`, or say on the card what GA4 is used for.
- **Effort:** medium.

### 3.3 First property wins, and the first account can block the connect
- **Status:** Likely broken.
- **Where:** `src/app/api/connectors/ga4/callback/route.ts:80` takes `accountSummaries[0].propertySummaries[0]`. If the first account has no properties, the connect fails with `ga4_no_property` even when later accounts have properties.
- **What the user sees:** An agency or multi-property user connects the wrong property, or cannot connect at all.
- **Fix:** Flatten all properties and show a picker when there is more than one.
- **Effort:** medium.

### 3.4 Failed refresh hands back the expired token
- **Status:** Broken (code proves it).
- **Where:** `src/lib/shared-access/ga4-token.ts:31-51`. When the refresh fails it silently returns the expired token, and the caller gets a 401 that is only logged (`ga4-daily-sync.ts:79-83`). `ga4_connections` has no `last_error` column.
- **What the user sees:** A revoked GA4 consent never shows as broken.
- **Fix:** Return null and mark an error column on refresh failure.
- **Effort:** small.

### 3.5 Unused scope and an orphaned route
- **Status:** Inert / defect.
- **Where:**
  - `ga4/auth/route.ts:9` requests `analytics.manage.users.readonly`. Nothing uses it, and it adds weight to Google verification.
  - `src/app/api/connectors/ga4/connect/route.ts` accepts a plaintext `access_token` and any `property_id` from the request body. No UI calls it.
- **Fix:** Drop the scope. Delete the route.
- **Effort:** small.

### 3.6 Deprecated `conversions` metric
- **Status:** Likely broken in time.
- **Where:** `ga4-daily-sync.ts:73` and `ga4/sync/route.ts:62` request the GA4 metric `conversions`, which Google deprecated in favour of `keyEvents`.
- **Fix:** Switch to `keyEvents`.
- **Effort:** small.

---

## 4. HubSpot

- **Status:** Inert (missing credential: `HUBSPOT_CLIENT_ID`/`SECRET`; shown as Coming soon).
- **Notes:** State is set in a cookie, verified and consumed (`hubspot/callback/route.ts:35-39`). Tokens are encrypted. The refresh persists the rotated refresh token (`hubspot-daily-sync.ts:125-135`). The `metric_manual` unique key exists (`20260706000001`). No defect found. When the credentials arrive, swap the Coming soon card for `hubspot-connect-card.tsx`.

---

## 5. Email connectors (Mailchimp, Brevo)

### 5.1 Failures recorded as successful syncs
- **Status:** Broken (code proves it).
- **Where:**
  - `src/lib/inngest/functions/email-connector-sync.ts:117-120` and `:166-169`: an API error only logs and returns.
  - The caller then stamps `last_synced_at` (lines 76-78) and counts the sync as processed.
  - The `upsert` results at lines 141-143 and 197-199 are not checked.
  - `connectors/{mailchimp,brevo}/configure` saves the key without testing it.
- **What the user sees:** A mistyped API key shows as connected and "synced today" forever, with no data behind it.
- **Fix:** Validate the key at configure time (Mailchimp `/ping`, Brevo `/account`). Throw on a non-OK response. Add `last_error`.
- **Effort:** small.

### 5.2 Brevo statistics field names
- **Status:** Likely broken.
- **Where:** `email-connector-sync.ts:180-191` reads `statistics.globalStats.openRate`, `clickRate` and `recipients`. Brevo's `globalStats` exposes counts (`uniqueViews`, `uniqueClicks`, `delivered`, `sent`, `unsubscriptions`), not rates, and only when `statistics=globalStats` is requested.
- **What the user sees:** Brevo rows show blank open and click rates.
- **Fix:** Request `statistics=globalStats` and compute the rates from the counts.
- **Effort:** small.

### 5.3 Manual sync runs for every tenant
- **Status:** Broken (scope).
- **Where:** `connectors/mailchimp/sync/route.ts:10` sends the event with no brand, and the job syncs every tenant's connectors.
- **Fix:** Pass `brand_id` and filter on it in the job.
- **Effort:** small.

---

## 6. Payments (tenant Paystack and Flutterwave webhooks)

### 6.1 Retried webhooks double-count purchases
- **Status:** Broken (code proves it).
- **Where:**
  - Signatures are verified before any work: `webhooks/paystack/route.ts:30-47` uses HMAC-SHA512 with timing-safe compare, and `webhooks/flutterwave/route.ts:29-43` uses a timing-safe secret compare. Both fail closed when no config exists.
  - But `sdk_events` gets an unconditional `insert` (`paystack:98-106`, `flutterwave:95-103`) on every delivery, even when `purchase_events` dedupes on `(source, reference)`.
  - Paystack and Flutterwave both retry deliveries.
- **What the user sees:** Purchases are double-counted in the funnel (`dashboard/funnel/page.tsx:195`) and in the media mix model.
- **Fix:** Insert into `sdk_events` only when the `purchase_events` row is new (`ignoreDuplicates` plus `select`), or key `sdk_events` on the reference.
- **Effort:** small.

### 6.2 Keys not validated at configure time
- **Status:** Broken (UX).
- **Where:** `paystack`/`flutterwave` configure routes save the secret without testing it.
- **What the user sees:** A wrong secret shows as connected, then every webhook 400s.
- **Effort:** small.

### 6.3 BrandGauge billing webhooks
- **Status:** Inert by design.
- **Notes:** `billing/paystack/webhook` (fail-closed, timing-safe) and Stripe (`constructEvent`) are correct. The doc comment in `billing/paystack/webhook/route.ts:28-29` says the tenant handler compares with `===`. That is stale: the tenant handler now uses `timingSafeEqual`.

---

## 7. WhatsApp (Meta Cloud API, Model A)

All of this is **Inert (missing credential: `WHATSAPP_*`)** until the env vars are set. These defects will bite on the first send.

### 7.1 Broadcast counter is wrong and the daily limit leaks
- **Status:** Broken (code proves it). Inngest memoises completed steps and re-runs the handler on each step.
- **Where:** `src/lib/inngest/functions/whatsapp-broadcast.ts:105,129-147`. `totalSent` is mutated inside `step.run` callbacks, so on replay the steps already done do not re-execute and the counter resets.
- **What the user sees:**
  - The campaign's `sent` count (line 157) reflects only the last invocation.
  - The `remaining` guard can be exceeded, which breaks the 1,000-per-day hard stop CLAUDE.md requires.
- **Fix:** Return the count from each step and sum the returned values.
- **Effort:** small.

### 7.2 Daily limit counted per brand
- **Status:** Broken (code proves it).
- **Where:** `whatsapp-broadcast.ts:79-84` counts `.eq('brand_id', brandId)`. The WABA is one shared number across all brands, and Meta's 1,000-conversations limit applies per number.
- **What the user sees:** Three brands can send 3,000 a day and get the number restricted.
- **Fix:** Count across all brands. Also add the notification-centre warning the spec asks for.
- **Effort:** small.

### 7.3 START opts a number in for every brand
- **Status:** Broken (consent).
- **Where:** `src/app/api/whatsapp/webhook/route.ts:91-95`. A reply of START sets `whatsapp_opted_in=true` on every brand's contact row with that phone number.
- **What the user sees:** Consent given to one brand becomes consent for all brands. That is an NDPR problem.
- **Fix:** Tie opt-in to the campaign or brand the person is replying to (look up the latest `whatsapp_send_log` row for that hashed number).
- **Effort:** medium.

### 7.4 Missing env guard and API version
- **Status:** Inert.
- **Where:**
  - `whatsapp-broadcast.ts:5-6` falls back to `''` for the phone ID and token, so every contact gets logged as a failed send rather than the job stopping up front.
  - Graph `v20.0` is old. Meta auto-upgrades expired Graph versions, but it is worth pinning to a current version.
- **Effort:** small.

### 7.5 Africa's Talking paths still exist
- **Status:** Broken against the CLAUDE.md rule.
- **Where:**
  - `src/app/api/surveys/[id]/send-whatsapp/route.ts`: an orphaned route with no UI caller.
  - `src/lib/inngest/functions/panel-dispatch.ts:99-118`, where the call is also fire-and-forget with no response check.
  - CLAUDE.md says Africa's Talking was removed on 11 July. Doc 4 §5.3 lists these as known defects.
- **Fix:** Delete both. Route panel WhatsApp through `whatsapp/broadcast.send`.
- **Effort:** small.

---

## 8. Surveys and panels (email delivery)

### 8.1 Recipients see each other's addresses
- **Status:** Broken (code proves it).
- **Where:**
  - `src/app/dashboard/surveys/[id]/actions.ts:58-70` sends `to: batch` with up to 50 addresses.
  - `src/lib/inngest/functions/panel-dispatch.ts:72-90` does the same.
- **What the user sees:** Every recipient sees every other recipient's email.
- **Fix:** Send one message per recipient (`resend.batch.send` through `sendMail`, or a loop), or use `bcc`.
- **Effort:** small.

### 8.2 Panel survey insert fails, and would be empty anyway
- **Status:** Broken (code proves it).
- **Where:**
  - `panel-dispatch.ts:57-66` inserts `status: 'active'`. `surveys.status` CHECK allows only `draft`, `live` and `closed` (`20260610000000_initial_schema.sql:394-395`), so the step throws and Inngest retries until the run fails.
  - The insert never copies the template's `questions` (the column defaults to `'[]'`).
  - `/survey/[id]/page.tsx:26` only serves `'live'`.
- **What the user sees:** Panels never go out. With only the status fixed, they would go out empty.
- **Fix:** Insert `status: 'live'` with the questions from `survey-templates` for `template_key`.
- **Effort:** small.

### 8.3 Partial batch failure re-sends
- **Status:** Broken.
- **Where:** `panel-dispatch.ts:81-94`. If batch 3 of 5 fails, the step throws, and the retry re-sends batches 1 and 2.
- **Fix:** One step per batch.
- **Effort:** small.

---

## 9. Email (Resend) generally

Every send goes through `sendMail`; there is no direct `resend.emails.send` anywhere in `src`. The remaining issues:

### 9.1 Report recipients cut off at 50 users
- **Status:** Broken (code proves it). Supabase `auth.admin.listUsers()` returns 50 users per page by default.
- **Where:** `scheduled-reports.ts:106,204`, `competitive-weekly-briefing.ts:184` and `campaign-target-monitor.ts:162` call it unpaginated and then filter to workspace admins.
- **What the user sees:** Once the platform passes 50 users, admins outside the first page stop getting monthly reports, digests, briefings and target alerts.
- **Fix:** Use `auth.admin.getUserById` for each member id, or page through the list.
- **Effort:** small.

### 9.2 Unsubscribe the product cannot honour
- **Status:** Broken (code proves it).
- **Where:** `scheduled-reports.ts:127` promises "Unsubscribe from monthly reports in Settings", and the digest says "Manage digest preferences in Settings". No such setting exists in `src/app/dashboard/settings`.
- **Fix:** Add a preference flag and honour it, or remove the claim.
- **Effort:** small.

### 9.3 Digest alerts read a table that does not exist
- **Status:** Broken (code proves it).
- **Where:** `scheduled-reports.ts:172` reads `monitoring_alerts`, which no migration creates. The error is ignored, so the digest's Alerts section is always empty.
- **Effort:** small.

### 9.4 Lead alert result ignored
- **Status:** Minor.
- **Where:** `src/app/api/scoreboard/lead/route.ts:95` ignores `sendMail`'s result.
- **Effort:** small.

---

## 10. AI calls

### 10.1 Almost no call is attributed
- **Status:** Broken against the CLAUDE.md rule.
- **Where:** Only 1 of 52 `callAi` call sites passes `meta`. Examples: `api/ai/ask/route.ts:86`, `ai-visibility.ts:33,73,207`, `scheduled-reports.ts:80`, `pr-crawl.ts:127`, `lib/tools/*.ts`.
- **What the user sees:** Nothing directly, but almost every AI row lands under `feature: 'unattributed'` with no workspace. The Desk's AI cost per account (`data.ai_cost`) is close to empty.
- **Fix:** Pass `{ workspaceId, brandId, userId, feature }` at each call site.
- **Effort:** medium (mechanical).

### 10.2 Vision calls bypass `callAi`
- **Status:** Broken against the CLAUDE.md rule.
- **Where:** `api/ai/pre-post/route.ts:71`, `api/creative/compare/route.ts:120`, `api/creative/video/route.ts:99` and `lib/vision/brand-detector.ts:103` call `anthropic.messages.create` directly, with the model ID `claude-sonnet-4-6` hardcoded in three of them.
- **What the user sees:** No `ai_calls` or `usage_events` rows, so the costliest calls (images and video) are invisible.
- **Fix:** Let `callAi` accept content blocks, and route these four through it.
- **Effort:** small to medium.

### 10.3 Fragile JSON parsing in the AI Command Layer
- **Status:** Likely broken.
- **Where:** `api/ai/ask/route.ts:96` uses `JSON.parse(cleaned)` instead of the robust extractor in `client.ts`.
- **What the user sees:** Occasional "AI response could not be parsed".
- **Effort:** small.

### 10.4 Retired Gemini model in the AI Visibility Tracker
- **Status:** Likely broken.
- **Where:** `src/lib/ai/assistants.ts:78` pins `gemini-2.0-flash`, which Google has scheduled for retirement.
- **What the user sees:** The Gemini platform drops out of visibility scores.
- **Fix:** Move to the current Flash model ID.
- **Effort:** small.

---

## 11. Reviews, maps and other pull jobs

| Finding | Status | Where | Fix | Effort |
|---|---|---|---|---|
| The venue "Sync now" button calls `/api/venue/sync-maps`, which does not exist. The 404 HTML makes `res.json()` throw, and the user sees "Network error during sync". | Broken (code proves it) | `src/app/dashboard/brand-equity/venue-reputation-panel.tsx:75` | Add a route that sends `brandgauge/venue.maps.sync` with `brand_id` (the job already listens, `google-maps-sync.ts:40`). | small |
| Apple reviews are read from the US App Store. The RSS URL has no country segment, so Nigerian apps show few or no reviews. | Broken (code proves it uses the default storefront) | `app-review-sync.ts:37` | Use `https://itunes.apple.com/ng/rss/customerreviews/...`, and let the brand pick the storefront. | small |
| The app-rating upsert uses `onConflict: 'brand_id,event_type'` on `sdk_events`, which has no such constraint, so the rating score is never written. | Broken (code proves it) | `app-review-sync.ts:240-251` | Same fix as GA4 (§3.1). | small |
| The G2 and Capterra scrapers fetch HTML from a server User-Agent, and both sites sit behind bot protection. Null comes back and is logged at info level only. | Likely broken | `b2b-review-sync.ts:7-55` | Use the official G2 API or manual entry, and show "could not read" on the card. | medium |
| Google Maps uses the legacy Places API (`place/details/json`), which new Google Cloud projects cannot enable. `REQUEST_DENIED` is mapped to null and logged as "No rating returned". | Likely broken (depends on the key) | `google-maps-sync.ts:21-31` | Move to Places API (New) `places/{id}` with a field mask, and log `status` and `error_message`. | small |
| Play Store rating is scraped from HTML; Play reviews are never fetched. | Likely broken (fragile) | `app-review-sync.ts:57-80` | Accept as best-effort, or use the Play Developer API for owned apps. | medium |

---

## 12. Inngest wiring

- **Registration:** All 35 `createFunction` exports are registered in `src/app/api/inngest/route.ts`, and every event that is sent has a listener. Four triggers are never sent: `developer.health.sync`, `b2b.reviews.sync`, `venue.maps.sync` and `competitor/watch.check`. That is harmless, since they also run on cron, except that the venue button needs `venue.maps.sync` (§11).
- **Manual crawl runs for every tenant (Broken, code proves it).**
  - `api/inngest/trigger/route.ts:33-36` sends `brandgauge/crawl.requested` with no brand.
  - `crawl-mentions.ts:21` then crawls every brand in the system.
  - So one marketer's "Crawl now" spends X credit, Instagram hashtag quota and AI cost for all tenants, and their own result waits behind everyone else's.
  - Fix: pass `brandId` and filter on it, and add a concurrency key per brand. Effort small.
- **Diagnostic GET leaks key prefixes (Broken, security).**
  - `api/inngest/trigger/route.ts:73-90` returns the first 8 characters of `INNGEST_EVENT_KEY` and the first 16 of `INNGEST_SIGNING_KEY` to any signed-in customer.
  - The Desk rule is "never a prefix".
  - Fix: delete the GET. Effort small.
- **Counters inside `step.run`:** `processed++` and `synced++` inside `step.run` (GA4, Meta, Google Ads, HubSpot, email sync and others) under-count on replay. This is cosmetic everywhere except WhatsApp (§7.1).
- **Cron schedules:** All valid. `ai-visibility-weekly-cron` has no `TZ=` (it runs 09:00 UTC, 10:00 Lagos), which matches CLAUDE.md's "Monday 9am" only loosely.

---

## 13. Auth and Meta compliance

| Finding | Status | Where | Fix | Effort |
|---|---|---|---|---|
| Google sign-in uses `.maybeSingle()` on `workspace_members` by user. With 2+ memberships it errors, `member` comes back null, and a new workspace and blank brand are created on every login. The insert errors are unchecked too. | Broken (code proves it) | `src/app/api/auth/callback/route.ts:27-56` | Use `.select('workspace_id').limit(1)` and check the inserts. | small |
| Meta data deletion: `void supabase.from('meta_deletion_requests').insert(...)` never runs, because Supabase query builders are lazy and only execute when awaited (the migration `20261020070000` exists, so the table is there). The returned status URL `/data-deletion-status` has no page. The signature compare is not timing-safe. The fallback host is the old `brandpulse-ai-tau.vercel.app`. | Broken (code proves it) | `src/app/api/auth/meta/deauthorize/route.ts:19,28,62-71` | `await` the insert, add the status page, use `timingSafeEqual`. | small |
| Instagram finish-connect has no session check: anyone holding the pending key can complete it. The key is 128-bit random, so the risk is low. | Low | `social/instagram/finish-connect/route.ts:14-26` | Check that `auth.getUser().id === pending.userId`. | small |
| Meta and Google app review: Meta Ads (`ads_read`, `ads_management`), Instagram (`instagram_basic`, `instagram_manage_insights`, `pages_*`) and hashtag search need Advanced Access and App Review before any non-tester can connect. GA4's `analytics.readonly` is a sensitive scope: unverified apps show a warning screen and have a 100-user cap. The shared-access migration says verification is not done. | Inert (pending app review) | `ads/meta/connect:50`, `social/connect/[platform]:39,52`, `ga4/auth:7-10` | Finish App Review. Item 5 in the top 10 is a blocker for it. Until then, steer pilots to shared access. | large (process) |
| 18 files fall back to the old host `https://brandpulse-ai-tau.vercel.app`, and 15 fall back to `http://localhost:3000`, when `APP_URL` is unset. In OAuth routes, a missing `APP_URL` produces a localhost `redirect_uri`. `APP_URL` is not in the Desk credential list. | Likely broken in a misconfigured preview | e.g. `panel-dispatch.ts:6`, `ads/meta/connect/route.ts:10`, `social/connect/[platform]/route.ts:13` | One `appUrl()` helper that throws in production when unset, and add `APP_URL` to the Desk credentials list. | small |

---

## 14. Env vars

### 14.1 Every `process.env` read in `src`
The number is how many times each one is read.

ADMIN_SECRET(6), AFRICAS_TALKING_API_KEY(4), AFRICAS_TALKING_USERNAME(2), AFRICAS_TALKING_WHATSAPP_SENDER(2), ANTHROPIC_API_KEY(6), APP_URL(44), DESK_HOST(2), GITHUB_TOKEN(2), GOOGLE_ADS_CLIENT_ID(5), GOOGLE_ADS_CLIENT_SECRET(4), GOOGLE_ADS_DEVELOPER_TOKEN(4), GOOGLE_AI_API_KEY(2), GOOGLE_CLIENT_ID(4), GOOGLE_CLIENT_SECRET(2), GOOGLE_MAPS_API_KEY(3), GOOGLE_SERVICE_ACCOUNT_JSON(1), HUBSPOT_CLIENT_ID(5), HUBSPOT_CLIENT_SECRET(3), INNGEST_EVENT_KEY(2), INNGEST_SIGNING_KEY(1), LEAD_ALERT_EMAIL(1), LINKEDIN_ADS_CLIENT_ID(3), LINKEDIN_ADS_CLIENT_SECRET(1), META_APP_ID(7), META_APP_SECRET(5), META_BUSINESS_ID(1), META_SYSTEM_USER_ID(1), META_SYSTEM_USER_TOKEN(1), NEXT_PUBLIC_APP_URL(21), NEXT_PUBLIC_DESK_URL(1), NEXT_PUBLIC_MAPBOX_TOKEN(4), NEXT_PUBLIC_SHORT_DOMAIN(5), NEXT_PUBLIC_SUPABASE_ANON_KEY(3), NEXT_PUBLIC_SUPABASE_URL(9), NODE_ENV(4), OPENAI_API_KEY(2), PAGESPEED_API_KEY(2), PAYSTACK_SECRET_KEY(1), PERPLEXITY_API_KEY(2), RESEND_API_KEY(2), SERPAPI_KEY(3), STRIPE_PRICE_{AGENCY,ENTERPRISE,GROWTH,PRO}(1 each), STRIPE_SECRET_KEY(2), STRIPE_WEBHOOK_SECRET(1), SUPABASE_SERVICE_ROLE_KEY(7), TIKTOK_ADS_APP_ID(3), TIKTOK_ADS_SECRET(1), TOKEN_ENCRYPTION_KEY(2), TWITTER_ADS_API_KEY(3), TWITTER_ADS_API_SECRET(2), TWITTER_BEARER_TOKEN(5), TWITTER_CLIENT_ID(3), TWITTER_CLIENT_SECRET(2), UPSTASH_REDIS_REST_TOKEN(26), UPSTASH_REDIS_REST_URL(26), VERCEL_TOKEN(1), WHATSAPP_ACCESS_TOKEN(4), WHATSAPP_APP_SECRET(2), WHATSAPP_BUSINESS_ACCOUNT_ID(1), WHATSAPP_PHONE_NUMBER_ID(3), WHATSAPP_VERIFY_TOKEN(1), X_TOOL_DAILY_RUNS(2).

### 14.2 Env vars each integration needs

| Integration | Env vars |
|---|---|
| Meta Ads and Instagram/Facebook | META_APP_ID, META_APP_SECRET, APP_URL, UPSTASH_REDIS_REST_URL/TOKEN, TOKEN_ENCRYPTION_KEY |
| Meta shared access | + META_BUSINESS_ID, META_SYSTEM_USER_TOKEN, (META_SYSTEM_USER_ID) |
| X | TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET (user context), TWITTER_BEARER_TOKEN (free tools and post metrics), X_TOOL_DAILY_RUNS (optional) |
| GA4 | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET; shared: GOOGLE_SERVICE_ACCOUNT_JSON |
| Google Ads | GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN |
| HubSpot | HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET |
| LinkedIn / TikTok / X Ads | LINKEDIN_ADS_*, TIKTOK_ADS_APP_ID/SECRET, TWITTER_ADS_API_KEY/SECRET |
| WhatsApp | WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID (templates), WHATSAPP_APP_SECRET (webhook HMAC, fail-closed), WHATSAPP_VERIFY_TOKEN (handshake) |
| Jobs | INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY |
| Email | RESEND_API_KEY, LEAD_ALERT_EMAIL, NEXT_PUBLIC_DESK_URL |
| AI | ANTHROPIC_API_KEY; visibility: OPENAI_API_KEY / GOOGLE_AI_API_KEY / PERPLEXITY_API_KEY |
| Search | SERPAPI_KEY (demand finder, OOH uplift, geo-lift), PAGESPEED_API_KEY |
| Maps | GOOGLE_MAPS_API_KEY (server), NEXT_PUBLIC_MAPBOX_TOKEN (client) |
| Developer health | GITHUB_TOKEN (optional) |
| OOH custom domain | VERCEL_TOKEN |
| Billing | PAYSTACK_SECRET_KEY (ours), STRIPE_* (deferred) |

### 14.3 Cross-check findings
- **No name mismatches between files.** Google OAuth (`GOOGLE_CLIENT_*`) and Google Ads (`GOOGLE_ADS_CLIENT_*`) are separate on purpose. GA4 connect and refresh both use `GOOGLE_CLIENT_*`.
- **No `NEXT_PUBLIC_` var carries a secret.** Mapbox is a public token by design.
- **`src/lib/desk/ops.ts` CREDENTIALS (lines 51-75) leaves out vars that gate live features:**
  - INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY. These gate every job and should be marked blocking.
  - APP_URL / NEXT_PUBLIC_APP_URL (blocking).
  - UPSTASH_REDIS_REST_TOKEN.
  - META_APP_SECRET, GOOGLE_CLIENT_ID/SECRET, TWITTER_CLIENT_ID/SECRET, TWITTER_BEARER_TOKEN.
  - GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_SHORT_DOMAIN.
  - GOOGLE_ADS_*, HUBSPOT_*, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID, LEAD_ALERT_EMAIL.
  - The comment in ops.ts says the list mirrors CLAUDE.md; it does not.
- **`docs/prd/04-build-guide.md` §5 leaves out vars the code reads:** GOOGLE_SERVICE_ACCOUNT_JSON, META_BUSINESS_ID, META_SYSTEM_USER_TOKEN/ID, PAGESPEED_API_KEY, PAYSTACK_SECRET_KEY, DESK_HOST, NEXT_PUBLIC_DESK_URL, VERCEL_TOKEN, GITHUB_TOKEN and X_TOOL_DAILY_RUNS.
- **AFRICAS_TALKING_\* is still read in two places** (§7.5).
- **Fix for both lists:** Generate the env list from a grep in a check script (`npm run env:check`) that fails when a var is read but appears in neither list. Effort small.

---

## 15. Columns or tables that no migration creates

Found by the column script and confirmed against the migrations by hand.

| Reference | Where | Effect | Status | Fix | Effort |
|---|---|---|---|---|---|
| `loyalty_members.last_activity_at` (the column is `last_activity`) | `src/app/api/loyalty/transactions/route.ts:74` | The whole balance update fails, unchecked. Points and tier never change after a transaction. | Broken (code proves it) | Rename to `last_activity` and check the error. | small |
| `influencers.latest_post_reach` | `src/lib/bhi-inputs.ts:111` | The BHI's influencer input query errors, so that component is always empty. | Broken (code proves it) | Read from `influencer_posts`, or add the column. | small |
| `events.day`, `events.estimated_attendance` | `src/app/dashboard/page.tsx:52`, `api/campaigns/[id]/analyse/route.ts:33`, `dashboard/events/[id]/debrief/page.tsx:14` | The home dashboard's "upcoming events" query errors and always shows none. Campaign analysis loses its events. | Broken (code proves it) | Use `date_start` and `expected_attendance`. | small |
| `ooh_sites.name`, `ooh_sites.vanity_visits`, `ooh_sites.total_spend` | `api/funnel/stage-analysis/route.ts:57,147`, `api/mmm/run/route.ts:65` | OOH drops out of the funnel stage analysis and the media mix model. | Broken (code proves it) | Use `site_name` and `visits`, and take spend from the campaign or channel. | small |
| `print_placements.readership` | `api/mmm/run/route.ts:61` | Print drops out of the media mix model. | Broken (code proves it) | Compute it from the publication's `circulation × readership_mult`. | small |
| `competitors.type` | `api/portal/view/route.ts:103` | The board portal loses its competitor block. | Broken (code proves it) | Drop the column from the select. | small |
| `surveys.title` (the column is `name`) | `src/lib/desk/accounts.ts:236` | The Desk account view shows no surveys. | Broken (code proves it) | Select `name`. | small |
| `monitoring_alerts` (table) | `scheduled-reports.ts:172` | §9.3 | Broken | Point at the real alerts table, or remove the section. | small |
| `sdk_events` unique `(brand_id, event_type)` | `ga4-daily-sync.ts:107`, `app-review-sync.ts:250` | §3.1 and §11 | Broken | §3.1 | small |
| `surveys.status = 'active'` (CHECK) | `panel-dispatch.ts:59` | §8.2 | Broken | §8.2 | small |

Every other `onConflict` target matches a real unique constraint or index. No other literal value breaks a CHECK constraint.

---

## 16. Service client in user-triggered routes

70 non-admin, non-webhook files use `createServiceClient`. I spot-checked the ones that touch connectors or take an id from the request: `ads/drafts`, `crawl/run`, `sentiment/dispute`, `whatsapp/send`, `ai/conversations/[id]`, `competitive/sightings`, `campaigns/[id]/channels/[channelId]/creatives`, `event/leaderboard`, `event/interaction`, `first-party/[type]`, `brand/markers`, `media-plan/import` and `connectors/ga4/sync`. Each one either:
- verifies through the RLS client first,
- scopes with the active brand, or
- validates a token, key hash or session token.

I found no new cross-tenant hole. Three caveats:
- `social/instagram/finish-connect` has no session check (§13).
- Two Desk-sensitive reads assume a single Meta row, `.single()` / `.maybeSingle()` on `digital_ad_accounts` (`connectors/page.tsx:55`, `ooh/geo-audiences/[id]/sync/route.ts:41`). If a brand ends up with two Meta rows, for example after reconnecting with a different ad account (which gives a new `account_id`), both error and the brand shows as not connected.
- A full audit of all 70 files was not done in this pass.

---

## 17. Places where the UI says something works when the backend cannot

- The Digital page offers X Ads as available and promises data after tonight's sync (§2.9).
- The OOH geo-audience panel says "push to Meta Ads / Google Ads" (§2.11).
- The Meta Ads card shows Connected while the sync is failing (§2.3).
- Instagram, Facebook and X stay "active" after their tokens die (§1.1, §1.3).
- GA4 and email connectors stamp `last_synced_at` on failure (§3.1, §5.1).
- The connectors page recommends Firebase, AppsFlyer, Shopify, Jumia Food and CSV upload as connectors for the industry (`connectors/page.tsx:124-128`, `lib/industry-config.ts:195-207`). None of them exist as connectors. The same list is keyed on `industry`, not `brand_type`, against the CLAUDE.md rule.
- The venue "Sync now" button calls a route that does not exist (§11).
- The monthly report promises an unsubscribe the product does not have (§9.2).
- `/dashboard/settings/connections` shows a pending shared GA4 request as connected. Unlike the Connectors page, it has no `auth_mode`/`access_status` filter (lines 25-30).
