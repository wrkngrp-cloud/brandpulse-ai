# Migrating to brandgauge.app

**Do this first, before you submit anything to Meta or Google.**

Both reviewers bake the URLs you submit into the review. If you verify against
`brandpulse-ai-tau.vercel.app` and move afterwards, you redo both reviews. Google also
expects an app domain you can prove you own in Search Console, and a free hosting
subdomain is a bad bet for a branded consent screen. Moving first costs you a day.
Moving after costs you two review cycles, which is four to six weeks.

Budget: half a day of work, plus up to 48 hours of DNS propagation.

---

## Part 0: before you touch anything

- [ ] Buy `brandgauge.app` if you have not already (it is a Google-operated TLD, so it is
      HSTS-preloaded and HTTPS-only by default; that is fine, Vercel gives you TLS).
- [ ] Pick your registrar and get access to its DNS panel.
- [ ] Decide the short domain for OOH vanity links. `NEXT_PUBLIC_SHORT_DOMAIN` is a
      separate thing from the app domain. If you want `bgau.ge/abc123` style links, buy
      that separately. If you do not care yet, leave it unset and links fall back to the
      app domain.
- [ ] Write down every place the old domain is configured. The list is in Part 3. Do not
      trust memory here, a missed one is a silent broken login.

---

## Part 1: point the domain at Vercel

1. [ ] Vercel dashboard, open the BrandGauge project, **Settings, Domains**.
2. [ ] **Add** `brandgauge.app`.
3. [ ] **Add** `www.brandgauge.app` and set it to redirect to `brandgauge.app`. Pick the
       bare domain as primary, everything in the codebase assumes no `www`.
4. [ ] Vercel shows you DNS records. At your registrar add them exactly:
   - Apex `brandgauge.app`: an `A` record to the IP Vercel shows, or an `ALIAS`/`ANAME`
     to `cname.vercel-dns.com` if your registrar supports it.
   - `www`: a `CNAME` to `cname.vercel-dns.com`.
5. [ ] Wait. Check with `dig brandgauge.app +short` until it returns Vercel's IP.
6. [ ] Vercel shows **Valid Configuration** and issues a certificate. Confirm
       `https://brandgauge.app` loads the app.

**If it fails**

| Symptom | Cause | Fix |
|---|---|---|
| Vercel stuck on "Invalid Configuration" for hours | Registrar added a trailing dot, or you have a conflicting `A`/`CNAME` on the same name | Delete every other record on that exact name, re-add one record, wait 30 minutes |
| Certificate will not issue | A `CAA` record blocks Let's Encrypt | Add a `CAA` record allowing `letsencrypt.org`, or remove the existing CAA |
| Apex works, `www` does not | CNAME on apex instead of `www`, or registrar does not support ALIAS | Use Vercel's nameservers instead of records, or drop `www` entirely |
| Domain resolves to old host | Cached DNS | Nothing to fix, wait out the TTL. Lower TTL to 300 *before* the next migration |

---

## Part 2: environment variables

In Vercel, **Settings, Environment Variables**, for the **Production** environment:

- [ ] `APP_URL` = `https://brandgauge.app`
- [ ] `NEXT_PUBLIC_APP_URL` = `https://brandgauge.app`
- [ ] `NEXT_PUBLIC_SHORT_DOMAIN` = your short domain, or leave unset

No trailing slash on either. Every route builds URLs as `${APP_URL}/api/...`, so a
trailing slash produces `//api/...` and breaks the OAuth redirect match.

- [ ] Redeploy. Environment variables do not apply to existing deployments, you must
      trigger a new build.

> **Note on the hardcoded fallbacks.** 18 files fall back to
> `https://brandpulse-ai-tau.vercel.app` when `APP_URL` is unset. Once `APP_URL` is set
> in production, those fallbacks never fire. They are still worth cleaning up so a future
> environment cannot silently inherit the old domain. That is a separate tidy-up commit,
> not a blocker for this migration.

---

## Part 3: every integration that stores the old URL

This is the part people miss. Work down the list and tick each one.

### Supabase (breaks login if you skip it)
- [ ] Supabase dashboard, **Authentication, URL Configuration**
- [ ] **Site URL** = `https://brandgauge.app`
- [ ] **Redirect URLs**, add:
  - `https://brandgauge.app/api/auth/callback`
  - `https://brandgauge.app/**`
- [ ] Keep the old Vercel URL in the redirect list until you have confirmed the new one
      works, then remove it.

### Meta (`META_APP_ID`)
App Dashboard, **Facebook Login, Settings**, Valid OAuth Redirect URIs:
- [ ] `https://brandgauge.app/api/ads/meta/callback`
- [ ] `https://brandgauge.app/api/social/callback/facebook`
- [ ] `https://brandgauge.app/api/social/callback/instagram`

App Dashboard, **Settings, Basic**:
- [ ] App Domains: `brandgauge.app`
- [ ] Privacy Policy URL: `https://brandgauge.app/privacy-policy`
- [ ] Terms of Service URL: `https://brandgauge.app/terms`
- [ ] Data Deletion Request URL: `https://brandgauge.app/api/auth/meta/deauthorize`
- [ ] Deauthorize Callback URL: `https://brandgauge.app/api/auth/meta/deauthorize`

WhatsApp, **Configuration**:
- [ ] Callback URL: `https://brandgauge.app/api/whatsapp/webhook`
- [ ] Verify token: the value of `WHATSAPP_VERIFY_TOKEN`
- [ ] Click **Verify and save**, it must go green immediately

### Google Cloud Console
**APIs and Services, Credentials**. You have two OAuth clients.

Client used by `GOOGLE_CLIENT_ID` (GA4 and Google Sign-In):
- [ ] `https://brandgauge.app/api/connectors/ga4/callback`
- [ ] `https://<your-project-ref>.supabase.co/auth/v1/callback` (Google Sign-In goes
      through Supabase, not through your app; this one does not change)

Client used by `GOOGLE_ADS_CLIENT_ID`:
- [ ] `https://brandgauge.app/api/ads/google/callback`
- [ ] `https://brandgauge.app/api/ads/google-ads/callback`

> Both Google Ads redirect URIs are live. The Digital page links to
> `/api/ads/google/connect` and the Connectors card links to
> `/api/ads/google-ads/connect`. Register both or one of the two entry points breaks.

**OAuth consent screen**:
- [ ] Application home page: `https://brandgauge.app`
- [ ] Privacy policy: `https://brandgauge.app/privacy-policy`
- [ ] Terms of service: `https://brandgauge.app/terms`
- [ ] Authorized domains: `brandgauge.app`

### Other connectors
- [ ] **X/Twitter** developer portal, callback URI:
      `https://brandgauge.app/api/social/callback/twitter`
- [ ] **LinkedIn** app, redirect URL: `https://brandgauge.app/api/ads/linkedin/callback`
- [ ] **TikTok** for Business, redirect URI: `https://brandgauge.app/api/ads/tiktok/callback`
- [ ] **HubSpot** app, redirect URL: `https://brandgauge.app/api/connectors/hubspot/callback`
- [ ] **Inngest**, app URL: `https://brandgauge.app/api/inngest`, then **Resync**
- [ ] **Resend**, add and verify `brandgauge.app` as a sending domain (SPF, DKIM, and a
      DMARC record). Until DKIM passes, survey invitations land in spam.
- [ ] **Paystack / Stripe**, webhook URL to `https://brandgauge.app/api/webhooks/...`
      (deferred per the project rules, but update it when you turn billing on)

---

## Part 4: prove it works

Do not tick these from reading the code. Actually click through.

- [ ] `https://brandgauge.app` loads, and `http://` redirects to `https://`
- [ ] `www.brandgauge.app` redirects to the bare domain
- [ ] Sign out, sign in with email. You land on `/dashboard`, not a login loop
- [ ] Sign in with Google. A brand-new Google account provisions a workspace and lands on
      `/onboarding`
- [ ] Connect one social account end to end and confirm data appears
- [ ] `https://brandgauge.app/privacy-policy` loads
- [ ] `https://brandgauge.app/terms` loads
- [ ] `https://brandgauge.app/data-deletion-status` loads and says no reference supplied
- [ ] Send one survey email and confirm it arrives in an inbox, not spam
- [ ] Open a `/go/<slug>` OOH link and confirm the redirect still works

**If login loops back to the sign-in page:** the Supabase Site URL is still the old
domain. That is the cause nine times out of ten.

**If an OAuth connect returns `redirect_uri_mismatch`:** the URI at the provider does not
match byte for byte. Check for a trailing slash, `http` instead of `https`, or `www`.

---

## Part 5: after it is stable

- [ ] Leave the Vercel URL working for a week as a fallback, then remove old redirect URIs
      from every provider
- [ ] Update `BUILD_STATUS.md` and `README.md` to the new domain
- [ ] Submit `brandgauge.app` to the HSTS preload list only once you are certain, it is
      slow to reverse

---

## Rollback

If something breaks badly, you do not need to unpick DNS. Set `APP_URL` and
`NEXT_PUBLIC_APP_URL` back to the Vercel URL and redeploy. The app returns to the old
domain within a minute. The provider redirect URIs you added are additive and harmless,
leave them.
