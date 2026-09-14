# Meta verification and App Review

**Goal:** beta users who are not you can connect their own Facebook Page, Instagram
Business account and Meta Ads account to BrandGauge.

**What actually blocks you today:** your Meta app is in Development mode with Standard
Access. In that state only people with a role on the app (Admin, Developer, Tester) can
complete OAuth. Everyone else sees an error. Adding each beta user as a Tester is the
short-term workaround. Advanced Access through App Review is the real fix.

**Realistic timeline:** Business Verification 2 to 10 business days. App Review 3 to 15
business days per submission, and first submissions are usually rejected once. Start now.

---

## The two things that are often confused

| | What it is | Needed for |
|---|---|---|
| **Business Verification** | Meta confirms your company legally exists | Unlocks the ability to request most Advanced Access permissions |
| **App Review** | Meta confirms your app uses each permission legitimately | Each individual permission |

You need both. Business Verification comes first.

---

## Permissions BrandGauge actually requests

Taken from the code, not from memory:

| Permission | Requested by | Access needed |
|---|---|---|
| `public_profile` | Facebook and Instagram connect | Advanced by default, nothing to do |
| `pages_show_list` | `/api/social/connect/facebook` and `instagram` | Advanced, needs review |
| `pages_read_engagement` | `/api/social/connect/facebook` and `instagram` | Advanced, needs review |
| `instagram_basic` | `/api/social/connect/instagram` | Advanced, needs review |
| `instagram_manage_insights` | `/api/social/connect/instagram` | Advanced, needs review |
| `ads_read` | `/api/ads/meta/connect` | Advanced, needs review |
| `ads_management` | `/api/ads/meta/connect` | Advanced, needs review |
| `read_insights` | `/api/ads/meta/connect` | Advanced, needs review |

> **Check the permission names before you submit.** Meta has been migrating Instagram
> integrations away from `instagram_basic` and `instagram_manage_insights` toward the
> Instagram-login permission set. Open your App Dashboard, **App Review, Permissions and
> Features**, and search for each name above. If a permission shows as deprecated, that is
> a code change in `src/app/api/social/connect/[platform]/route.ts` before you submit, not
> a form-filling problem. Do this check first, it changes what you submit.

> **`ads_management` is worth questioning.** BrandGauge only reads ad data. `ads_read`
> covers reading campaigns and insights. `ads_management` is a write permission and
> reviewers push back hard on apps requesting write access they never use. Dropping it
> from the scope string makes the submission materially easier to pass. If nothing in the
> codebase writes to Meta Ads, drop it.

---

## Part 1: Business Verification

- [ ] Go to **business.facebook.com**, open **Business Settings, Business Info**
- [ ] Confirm the legal business name matches your CAC registration exactly, character for
      character, including "Limited" versus "Ltd"
- [ ] Add the registered business address and a business phone number
- [ ] Add your website: `https://brandgauge.app`
- [ ] Start **Security Center, Verify your business** (or Business Info, Verification)
- [ ] Upload the documents below
- [ ] Complete the phone or email confirmation Meta sends to the business contact

### Documents to have ready (Nigeria)
- [ ] **CAC Certificate of Incorporation** (a clear PDF or photo, all four corners visible)
- [ ] **CAC Status Report** or Form CAC 1.1, showing the business address
- [ ] A **utility bill or bank statement** in the business name, issued in the last 90 days
- [ ] A **business phone number** you can answer, on the same domain or listed publicly
- [ ] A **business email on `@brandgauge.app`**. Set this up before you start. A Gmail
      address is a common rejection reason

**If verification fails**

| Rejection reason | What it really means | Fix |
|---|---|---|
| "Documents do not match business details" | Name or address differs by a word | Edit Business Info to match the CAC document exactly, then resubmit |
| "Document is not legible" | Photo is cropped, glared, or low resolution | Rescan as a flat PDF, 300 dpi, no shadow |
| "Unable to verify phone number" | Number not publicly associated with the business | Put the number in the footer of `brandgauge.app`, wait a day, resubmit |
| Rejected twice | Automated checks are stuck | Use the **Appeal** link in Security Center and attach a cover letter explaining the business. Appeals reach a human |

You get a limited number of attempts in a window. Get the documents right before
uploading rather than iterating.

---

## Part 2: prepare the app before submitting

Do every item here before you open the review form. Reviewers fail submissions for these
more often than for the integration itself.

### App settings
- [ ] **Settings, Basic**: display name `BrandGauge`, contact email on `@brandgauge.app`
- [ ] App icon, 1024x1024 PNG, square, no transparency, no rounded corners
- [ ] Category: `Business and Pages`
- [ ] App Domains: `brandgauge.app`
- [ ] Privacy Policy URL: `https://brandgauge.app/privacy-policy`
- [ ] Terms of Service URL: `https://brandgauge.app/terms`
- [ ] Data Deletion Request URL: `https://brandgauge.app/api/auth/meta/deauthorize`
- [ ] Deauthorize Callback URL: `https://brandgauge.app/api/auth/meta/deauthorize`
- [ ] Business Account: link the app to the verified business from Part 1

### Verify the deletion flow yourself
The reviewer will test this. It now writes to a real table and returns a status URL that
resolves.

- [ ] Apply the migration: `supabase db push` (adds `meta_deletion_requests`)
- [ ] Open `https://brandgauge.app/data-deletion-status`, confirm it renders
- [ ] In the App Dashboard use the **Data Deletion Request URL** test button. It must
      return a JSON body with `url` and `confirmation_code`
- [ ] Open the `url` it returned. It must show the request, not "reference not found"

### A reviewer test account
Meta reviewers are outside your organisation and cannot use your production data.

- [ ] Create a BrandGauge login for the reviewer: `reviewer@brandgauge.app`, fixed password
- [ ] Seed that workspace with a brand so the dashboard is not empty
- [ ] Create a throwaway Facebook Page and an Instagram Business account, and a Meta Ads
      account with at least one campaign, so the reviewer has something to connect
- [ ] Confirm you can log in as that user in a private window and complete the full connect
      flow yourself. If you cannot, the reviewer cannot

---

## Part 3: the submission

For each permission, **App Review, Permissions and Features**, click **Request Advanced
Access**, then fill in:

### Screencast
One video per permission group. Record with the reviewer test account, in a private
window, no cuts.

- [ ] Show logging in to `brandgauge.app` with the reviewer credentials
- [ ] Show navigating to Connectors
- [ ] Show clicking Connect, the **full Meta consent dialog with the permissions visible**,
      and granting
- [ ] Show returning to BrandGauge and the data appearing in the dashboard
- [ ] Narrate or caption what each permission is being used for

The single most common rejection is a video that does not show the consent dialog. Do not
skip or speed past that screen.

### Written justification
Say plainly what the permission does for the user. One clear paragraph each. For example,
for `pages_read_engagement`:

> BrandGauge shows marketing teams how their own Facebook Page is performing. We use
> pages_read_engagement to read likes, comments, shares and reach on the Page the user
> selects, so we can calculate their Brand Health Index and populate the Content
> Performance table. We read only Pages the user explicitly connects, and we never post.

### Step-by-step instructions
Write them for someone who has never seen the product:

```
1. Go to https://brandgauge.app/auth/login
2. Email: reviewer@brandgauge.app   Password: <the password>
3. Click "Connectors" in the left navigation
4. Click "Connect" on the Instagram card
5. Log in with the test Instagram account provided below
6. Grant the requested permissions
7. You return to Connectors and the Instagram card shows "Connected"
8. Click "Sentiment" in the left navigation to see the data we read
```

- [ ] Include the test Facebook and Instagram credentials in the submission notes
- [ ] Submit

---

## Part 4: after approval

- [ ] Switch the app from **Development** to **Live** (toggle at the top of the dashboard).
      Advanced Access does nothing while the app is in Development mode
- [ ] Test a connect with an account that has no role on the app at all. This is the only
      real proof that beta users can connect
- [ ] Remove the beta users you added as Testers, they no longer need it

---

## If App Review rejects you

Rejections are normal and are not a judgement on the product. Read the reason carefully,
it is usually specific.

| Rejection | Fix |
|---|---|
| "We could not log in to your app" | Credentials were wrong, expired, or the reviewer hit a required onboarding step. Re-test in a private window, then resubmit with fresh credentials |
| "Your screencast did not show the permission in use" | Re-record showing the consent dialog and the resulting data on screen |
| "Your app does not appear to need this permission" | Either cut the permission, or rewrite the justification around a visible user-facing feature. This is the usual answer for `ads_management` |
| "Privacy policy does not cover this data" | The policy must name the specific data. Section 1 of `/privacy-policy` now lists Meta ads data explicitly |
| "Data deletion callback failed" | The table or status page was missing. Both now exist, confirm with `supabase migration list` that the migration is applied in production |
| "Business verification required" | Finish Part 1 before resubmitting |

You can resubmit as soon as you have fixed the issue, there is no cooling-off period.
Fix one thing at a time so you learn what the blocker actually was.

**If you are stuck after three rejections:** use the **Support, Direct Support** channel
in the App Dashboard. It is available once the business is verified and a human will read
the case.

---

## Interim workaround while you wait

You do not have to block the beta. In **App Roles, Roles**, add each beta user as a
**Tester**. They accept the invitation at `developers.facebook.com/requests` and can then
complete the full OAuth flow against your Development-mode app.

This works well up to roughly 20 to 30 users and requires a Facebook account per tester.
It is a bridge, not a destination, because every tester sees a developer warning and you
cannot scale it to a public beta.
