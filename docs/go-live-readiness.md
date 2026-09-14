# Go-live readiness: order of operations

Three pieces of work stand between BrandGauge today and beta users connecting their own
accounts. **The order matters.** Doing them in the wrong order costs you a full review
cycle, which is four to six weeks.

```
1. Migrate to brandgauge.app        docs/domain-migration-brandgauge-app.md
2. Meta Business Verification       docs/meta-verification-checklist.md   (Part 1)
   Google Search Console + consent  docs/google-verification-checklist.md (Parts 1-2)
3. Meta App Review                  docs/meta-verification-checklist.md   (Parts 2-4)
   Google OAuth verification        docs/google-verification-checklist.md (Part 3)
   Google Ads developer token       docs/google-verification-checklist.md (Part 4)
```

**Why the domain moves first.** Both reviewers record the URLs you submit. Verify against
the Vercel URL and you repeat both reviews after the move. Google also wants an app domain
you can prove you own in Search Console, and it expects the consent screen, the homepage
and the privacy policy to sit on one domain you control.

**Run Meta and Google in parallel.** They are independent. Both have long waits, so start
both the same week.

**Start Meta Business Verification and Google Search Console on day one.** They gate
everything after them and neither depends on code.

---

## What is already done

These were missing and are now in place, because both reviews check them:

| Item | Where | Why it matters |
|---|---|---|
| `meta_deletion_requests` table | `supabase/migrations/20260914000000_meta_deletion_requests.sql` | The deletion callback wrote to a table that did not exist, so every request was dropped |
| Deletion request is recorded reliably | `src/app/api/auth/meta/deauthorize/route.ts` | The insert was fire-and-forget and could be lost before the function returned |
| `/data-deletion-status` page | `src/app/data-deletion-status/page.tsx` | The callback returned a status URL that 404'd. Meta's reviewer opens it |
| `/terms` page | `src/app/terms/page.tsx` | Meta App Review requires a Terms URL and there was none |
| Google Limited Use disclosure | `src/app/privacy-policy/page.tsx` section 6 | The top cause of Google OAuth rejection |
| Google and Meta ads data named in the policy | `src/app/privacy-policy/page.tsx` section 1 | Reviewers check that the policy names the data actually collected |
| Terms link in the site footer | `src/components/landing/landing-page.tsx` | Reviewers check the URLs are reachable from the homepage |

**Before submitting anything:** run `supabase migration list`, confirm the deletion
migration is the only pending item, then `supabase db push`. The deletion flow is broken
in production until you do.

---

## Decisions to make before you submit

1. **Drop `ads_management`?** BrandGauge only reads Meta ads data, but the scope string in
   `src/app/api/ads/meta/connect/route.ts` asks for write access. Reviewers challenge
   unused write permissions. Dropping it makes the submission easier to pass.
2. **Drop `analytics.manage.users.readonly`?** It only reads the property list. Fewer
   sensitive scopes means a faster Google review.
3. **Are the Instagram permission names current?** Meta has been migrating away from
   `instagram_basic`. Check the App Dashboard before submitting, it may mean a code change
   first.
4. **Business email on `@brandgauge.app`.** Both reviews want one. A Gmail address is a
   common rejection reason. Set this up during the domain migration.

---

## Interim: unblocking beta users this week

You do not have to wait for either review to start testing with real people.

- **Meta:** add each beta user as a **Tester** under App Roles. They accept at
  `developers.facebook.com/requests` and can then connect normally. Works to roughly 20 to
  30 users.
- **Google:** set the consent screen to **Testing** and add up to 100 **Test users**. Be
  aware refresh tokens expire after 7 days in Testing mode, so GA4 connections break
  weekly until verification lands.

Both are bridges. Neither scales to a public beta.
