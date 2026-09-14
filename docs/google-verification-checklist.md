# Google verification

**Goal:** beta users who are not you can connect their own Google Analytics property and
their own Google Ads account, without a scary warning screen.

There are **three separate approvals** here and they are easy to confuse. You need all
three for the Digital Ads module to work for real users.

| # | Approval | Covers | Who grants it | Typical time |
|---|---|---|---|---|
| 1 | **OAuth consent screen verification** | The consent screen, the warning, the user cap | Google Trust and Safety | 2 to 6 weeks |
| 2 | **Google Ads API developer token, Basic Access** | Calling the Google Ads API against real accounts | Google Ads API team | 3 to 10 business days |
| 3 | **Search Console domain verification** | Proving you own `brandgauge.app` | Automatic, instant | Minutes |

Number 3 is a prerequisite for number 1. Do it first, it takes five minutes.

---

## What is blocking you today

Your app requests **sensitive** scopes:

| Scope | Requested by | Classification |
|---|---|---|
| `analytics.readonly` | `/api/connectors/ga4/auth` | Sensitive |
| `analytics.manage.users.readonly` | `/api/connectors/ga4/auth` | Sensitive |
| `adwords` | `/api/ads/google/connect` and `/api/ads/google-ads/connect` | Sensitive |
| `openid`, `email`, `profile` | Google Sign-In via Supabase | Not sensitive, no review needed |

Unverified apps requesting sensitive scopes get two penalties:

1. Every user sees a **"Google hasn't verified this app"** interstitial, behind an
   "Advanced" link. Most beta users will not click through it.
2. A **100 user lifetime cap**. Not 100 at a time, 100 ever. Once you hit it, nobody new
   can connect and you cannot reset the counter.

So you can run a very small beta unverified. You cannot run a real one.

> **Check whether any scope reads as Restricted.** In the consent screen editor, each
> scope is labelled Sensitive or Restricted. Everything above should read Sensitive. If
> any of them shows as **Restricted**, you also need an annual third-party CASA security
> assessment, which costs money and adds weeks. Confirm the labels before you plan the
> timeline, and reconsider `analytics.manage.users.readonly`, which is the least load
> bearing of the three and only reads the property list.

---

## Part 0: consolidate your OAuth clients

You have two client IDs, `GOOGLE_CLIENT_ID` and `GOOGLE_ADS_CLIENT_ID`.

Verification applies to the **Cloud project and its consent screen**, not to individual
clients. If those two clients sit in different Cloud projects, you need two separate
verifications.

- [ ] Open both clients in **Google Cloud Console, APIs and Services, Credentials**
- [ ] Confirm they are in the **same project**
- [ ] If they are not, create a second client in the main project, move
      `GOOGLE_ADS_CLIENT_ID` to it, and update the env var. One verification then covers
      everything

- [ ] Enable the APIs you call, **APIs and Services, Library**:
  - [ ] Google Analytics Data API
  - [ ] Google Analytics Admin API
  - [ ] Google Ads API

---

## Part 1: Search Console domain verification

- [ ] Go to **search.google.com/search-console**
- [ ] Sign in with **the same Google account that owns the Cloud project**. This matters,
      a mismatch is the single most common cause of "authorized domain" errors
- [ ] Add a **Domain** property for `brandgauge.app`
- [ ] Add the `TXT` record it gives you at your registrar
- [ ] Click **Verify**

**If it fails:** DNS has not propagated. Check with
`dig TXT brandgauge.app +short`. Wait and retry, the record is not wrong, it is just not
visible yet.

---

## Part 2: the consent screen

**APIs and Services, OAuth consent screen**:

- [ ] User Type: **External**
- [ ] App name: `BrandGauge` (must match what users see on your site, exactly)
- [ ] User support email: an address on `@brandgauge.app`
- [ ] App logo: 120x120 PNG, square. Uploading a logo triggers a brand review, which is
      normal and happens alongside verification
- [ ] Application home page: `https://brandgauge.app`
- [ ] Privacy policy: `https://brandgauge.app/privacy-policy`
- [ ] Terms of service: `https://brandgauge.app/terms`
- [ ] Authorized domains: `brandgauge.app`
- [ ] Developer contact email
- [ ] Add the scopes listed above
- [ ] Publishing status: **In production** (you cannot submit for verification while in
      Testing)

### The requirements reviewers actually check on your site

- [ ] The **homepage explains what BrandGauge does** and is not a login wall. A reviewer
      who lands on a sign-in form with no explanation fails the submission
- [ ] The homepage **links to the privacy policy** in the footer
- [ ] The privacy policy is on the **same domain** as the app
- [ ] The privacy policy contains the **Limited Use disclosure**. This is now section 6 of
      `/privacy-policy` and reads: "BrandGauge's use and transfer of information received
      from Google APIs to any other app will adhere to the Google API Services User Data
      Policy, including the Limited Use requirements." Missing this is the number one
      rejection reason
- [ ] The privacy policy **names the Google data you collect** and why. Section 1 now does

---

## Part 3: the verification submission

Google asks for a justification per scope and a demo video.

### Scope justifications
Be concrete and tie each scope to a feature the user can see.

For `analytics.readonly`:
> BrandGauge shows marketing teams how their brand campaigns drive website traffic and
> conversions. We use analytics.readonly to read aggregate session, channel and conversion
> reporting from the single GA4 property the user selects, so we can attribute offline and
> social activity to site outcomes in their dashboard. We read only. We never modify the
> user's Analytics configuration.

For `adwords`:
> BrandGauge consolidates paid media performance across platforms into one view. We use
> the adwords scope to read campaign names, spend, impressions, clicks and conversions from
> the Google Ads account the user connects, so we can show blended cost per outcome
> alongside their other channels. We do not create, edit, pause or spend against campaigns.

### Demo video
Unlisted YouTube video. It must show, in one take:

- [ ] The `brandgauge.app` URL **visible in the browser address bar**
- [ ] Clicking Connect in the BrandGauge UI
- [ ] The **full OAuth consent screen**, with the app name and every requested scope
      readable on screen
- [ ] Granting consent
- [ ] Returning to BrandGauge and the Google data appearing in the dashboard
- [ ] A walk through the privacy policy page showing the Limited Use text

- [ ] Submit for verification and watch the developer contact inbox. Google replies by
      email and **an unanswered question stalls the review indefinitely**. Reply within a
      day or two

---

## Part 4: Google Ads API developer token (separate, and often forgotten)

OAuth verification does not give you Google Ads API access. `GOOGLE_ADS_DEVELOPER_TOKEN`
starts at **Test Access**, which only works against Google Ads *test* accounts. Against a
beta user's real account it returns a permission error, even with perfect OAuth.

- [ ] Create a **Google Ads Manager (MCC) account** if you do not have one
- [ ] In the MCC: **Tools, Setup, API Center**
- [ ] Copy the developer token, this is `GOOGLE_ADS_DEVELOPER_TOKEN`
- [ ] Apply for **Basic Access**

The application asks how you use the API. Answer honestly and in detail:
- [ ] Describe BrandGauge as a read-only reporting and analytics tool
- [ ] State clearly that you do **not** manage or create campaigns
- [ ] Give the tool's URL, `https://brandgauge.app`
- [ ] Include screenshots of the dashboard where Google Ads data appears
- [ ] Confirm compliance with the Google Ads API Terms, including the Required Minimum
      Functionality rules

**If the token application is rejected**

| Reason | Fix |
|---|---|
| "Insufficient detail" | Rewrite with specific field names you read and screenshots of where they appear |
| "Does not meet Required Minimum Functionality" | Your tool must do more than mirror the Ads UI. Emphasise the cross-channel blending and the Brand Health Index, which Google Ads cannot do |
| "Tool not publicly accessible" | Reviewers try to reach the URL. Make sure `brandgauge.app` loads and explains the product without a login |

Basic Access allows 15,000 operations a day, which is far more than a beta needs. Do not
apply for Standard Access yet.

---

## If verification is rejected

| Rejection | Fix |
|---|---|
| "Privacy policy is not accessible" or "does not mention Google" | Confirm the page loads for a signed-out visitor and contains the Limited Use text. Reviewers check anonymously |
| "Homepage does not explain the application" | Add a plain description of what BrandGauge does above the fold, and a footer link to the privacy policy |
| "Domain ownership could not be verified" | The Search Console account and the Cloud project owner are different Google accounts. Fix in Part 1 |
| "Scope justification insufficient" | Reply to the email with a fuller explanation and timestamps in the video showing that exact scope in use. Do not start a new submission, reply to the open thread |
| "App name does not match" | The consent screen name, the site title and the logo must agree. Make all three say BrandGauge |
| No reply for over three weeks | Reply to the original thread asking for a status update. Replying keeps the case active, silence lets it go stale |

Rejections come as an email thread with a real reviewer. **Always reply on the existing
thread** rather than opening a new submission, otherwise you go back to the end of the
queue.

---

## Interim workaround while you wait

In the consent screen editor, set publishing status to **Testing** and add beta users
individually under **Test users**. Up to 100 test users can complete the flow.

Trade-off: test users still see the unverified warning, and refresh tokens issued in
Testing mode **expire after 7 days**, so their connection silently breaks weekly. That
matters for BrandGauge because GA4 sync depends on a stored refresh token. Warn your beta
users, or keep the group small until verification lands.
