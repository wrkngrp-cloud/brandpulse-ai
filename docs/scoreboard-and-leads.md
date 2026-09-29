# The press scoreboard, and what happens to a lead

A free tool at `/scoreboard` that anyone can run without an account, and the
desk at `/dashboard/leads` where the addresses it captures are worked.

## Why it is shaped this way

The board is shown in full before an email is asked for. Gating a result
someone has already earned is what stops a free tool being shared, and an
address given only to unlock a number we promised is not a lead worth having.
What the address buys is the Monday email and nothing else, which is a thing we
do for them rather than a thing we withhold.

The ask is then ordered by commitment. The cheap one first, an address for the
weekly watch. The expensive one second, an account. Someone who takes neither
still got something true and free, which is the point.

## The funnel, end to end

1. Landing page, between Industries and the closing ask, links to `/scoreboard`.
   There is also a Flare "Free tool" item in the nav.
2. Visitor types their brand and up to three rivals. Nothing connected, nothing
   of theirs sent anywhere. `POST /api/scoreboard/scan` reads Google News RSS
   for each name, narrowed to ten Nigerian outlets, weights each story by that
   outlet's readership, prices it at a ₦500 CPM and returns the share split.
   The scan is recorded in `public_scans`.
3. The board renders free. Below it: what press alone cannot see, then the two
   asks.
4. An address posts to `POST /api/scoreboard/lead`, which upserts `leads`
   against the scan and emails the desk straight away.
5. `scoreboard-weekly` re-runs every opted-in lead's four brands at 08:00 Lagos
   on Mondays and writes to them when their share has moved.

## Setting it up

**Apply the migration.** `supabase/migrations/20260914090000_lead_capture.sql`
adds `public_scans`, `leads` and `lead_desk_admins`. Run `supabase migration
list` first and confirm it is the only pending item, then `supabase db push`.

**Give the EA access.** Access is an explicit allowlist, not a workspace role,
because a lead belongs to BrandGauge and not to a tenant. They sign up normally
at `/auth/signup`, then add their row with the service role:

```sql
insert into lead_desk_admins (user_id, email, note)
select id, email, 'EA' from auth.users where email = 'their@address.com';
```

They will then see `/dashboard/leads`. Anyone not on that list gets redirected,
and RLS returns them nothing even if they call the API directly.

**Environment.**

| Variable | What it does | Without it |
| --- | --- | --- |
| `LEAD_ALERT_EMAIL` | Where the "new lead" mail goes. Comma-separate for several. | No alert is sent. The lead is still saved. |
| `RESEND_API_KEY` | Already set for reports. Sends the alert and the Monday mail. | Neither is sent. Everything else works. |
| `UPSTASH_REDIS_*` | Already set. Rate limit and six-hour cache. | Both fail open. The tool still works, unthrottled. |

No new credential is needed for the feed itself. Google News exposes RSS with
no key, which is the whole reason this can run for a stranger.

## Working the desk

Search by person, company or the brand they scanned. Filter by status. Each
lead shows what they ran and the share they were looking at, which is the
follow-up: "you came out at 8% against Moniepoint and PalmPay" is a different
opening line from "just following up". **Write to them** opens a mail with that
already drafted. Notes save when you click away. Export CSV gives you whatever
the current filter shows.

Statuses are New, Contacted, Qualified, Converted, Not for us. Moving a lead to
Contacted stamps the time. A lead marked Not for us is skipped by the Monday
job, so marking it is also how you stop writing to someone.

## What is honest about the numbers, and must stay on the page

Readership figures are practitioner estimates, not audited circulation. No
public Nigerian circulation dataset exists. They rank the outlets correctly,
which is what a share is made of, and the page says so where the stories are
listed. Earned value is that readership at a ₦500 CPM, the same rate the
nightly `pr-crawl` job uses, so a figure here and a figure inside the product
agree.

A feed we could not read is never presented as silence. `feedOk` carries the
difference, the page says we could not look, and nothing is cached and no email
is asked for off a failed read.
