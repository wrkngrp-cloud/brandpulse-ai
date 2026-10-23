# Revenue Attribution: the plan

**Status:** proposal, not yet built. Written 23 October 2026.
**Scope:** the six questions a marketing manager asks about money, and what it takes to answer
them from real data with no spreadsheet work.

This doc sits with the other working docs in `docs/`. It is not part of the PRD set and it does
not change a locked decision. If it is adopted, Documents 2 and 3 get the module entries and the
metric formulas, and this file becomes the build note behind them.

---

## 1. The six questions

A marketing manager at a Nigerian brand wants to answer these, on a Monday morning, without
asking anyone for a file:

1. Which channels generate the most attributed revenue?
2. Which campaigns have the strongest return on ad spend?
3. Which campaigns are spending without producing eligible conversions?
4. What does it cost to acquire a customer through each paid channel?
5. Which campaigns are approaching or exceeding their budgets?
6. How much revenue cannot be attributed to a paid campaign?

Today BrandGauge answers question 5 properly, answers 2 and 3 partly, and does not answer 1, 4
or 6 at all. Question 1 and 6 have no mechanism behind them anywhere in the codebase.

## 2. The diagnosis in one sentence

**Every pipe we need already exists and already runs on a schedule. What is missing is one join
key, so revenue and spend sit in the same database but never meet.**

This is a much smaller problem than it looks. We are not building an attribution platform from
nothing. We are adding a dimension to tables that are already being filled automatically.

## 3. What already works (and most of it is automatic)

Worth being precise about this, because it is the reason the build is weeks and not quarters.

| What | Where | Automatic? |
|---|---|---|
| Real signed revenue, per transaction, with customer email | `purchase_events`, filled by `/api/webhooks/paystack` and `/api/webhooks/flutterwave` | Yes. Paste a secret key once, Paystack posts for the life of the account |
| Real ad spend, per campaign, per day, per platform | `digital_performance_daily`, filled by `meta-ads-daily-sync.ts` and `google-ads-daily-sync.ts` | Yes, 5am Lagos daily |
| Conversion counts and CPA per campaign | same table, computed in both syncs | Yes |
| Spend, revenue, new customers and MQLs rolled into monthly metrics | `commercial-metrics-rollup.ts` into `metric_manual` | Yes, 6am Lagos daily, and it refuses to write a zero when a source is missing |
| Brand-level CAC, CPL, ROI, ROAS, LTV:CAC | `src/lib/commercial-metrics.ts` | Yes, off the rollup above |
| Budget plans, pacing, variance, over-budget flags | `budget_plans` / `budget_line_items` / `budget_actuals`, `/dashboard/budget` | No. Actuals are typed by hand |
| Per-campaign KPI targets with off-track alerts | `campaign_targets` + `campaign-target-monitor.ts` | Yes, and it reads live ad data |
| A website pixel and an ingestion endpoint | `/api/sdk/pixel.js`, `/api/sdk/event`, `sdk_events`, `pixel_configs` | Built, but broken. See section 4 |
| Offline media that redirects through our own link and appends UTMs | `/go/[slug]`, `withUtm` in `src/lib/tools/offline-tracker.ts` | Yes |
| GA4 connected by OAuth with token refresh | `ga4_connections`, `/api/connectors/ga4/*` | Yes for the connection. The sync pulls almost nothing. See section 4 |
| Meta and Google ad write access | `ads_read,ads_management` on Meta, full `adwords` scope on Google | Already granted at connect time |

That last row matters more than it looks. It is what makes the whole thing need no manual effort.

## 4. What is broken today (fix before building anything new)

Four real defects. Three of them are small. All four have to be cleared first or the new work
sits on sand.

**4.1 The pixel never reaches us.** `src/app/api/sdk/pixel.js/route.ts` posts to a relative URL:

```js
fetch('/api/sdk/event', { method: 'POST', ... })
```

Installed on a customer's website, that posts to the customer's own domain, which has no such
route. The pixel has never worked anywhere except on our own domain. The receiving end is
already CORS-ready, so the fix is an absolute URL baked in at build time. The loader also never
sets `session_id`, so two events from one visit cannot be stitched, and `pixel_configs.allowed_origins`
is declared but never enforced.

**4.2 ROAS in the product is random demo data.** Neither ad sync writes `roas` or any revenue
value. Meta's sync requests `actions` but not `action_values` or `purchase_roas`. Google's reads
`metrics.conversions` but not `metrics.conversions_value`. The only code that ever sets `roas`
is `src/lib/demo/digital-performance.ts:99`, as `rand(1.8, 4.2)`. A connected account shows blank
where a demo account shows a confident number.

**4.3 The GA4 sync throws away everything useful.** `ga4-daily-sync.ts` asks for three metrics
with no dimensions, no revenue and no channel grouping, then upserts one row per brand on
`onConflict: 'brand_id,event_type'`, so it overwrites yesterday and keeps no history. It also
never refreshes the access token, unlike the on-demand route next to it, so the nightly job
fails an hour after connection.

**4.4 The MMM module invents its numbers.** `src/app/api/mmm/run/route.ts` multiplies raw
activity by hardcoded channel constants (`events: 2.0, email: 1.8, digital: 1.5`), assumes
NGN 5,000 per lead, and computes a per-channel ROI from that. It also never reads
`digital_performance_daily`, so paid digital spend is absent, and it does
`digital.spend += e.value ?? 0` over purchase events, which adds conversion value into the spend
variable. The digital ROI it prints is arithmetically meaningless. Our own rule against inventing
a revenue impact is written for the free tools; the dashboard breaks it.

## 5. The design: one click id, carried end to end

### The idea

Mint a first-party id the moment someone arrives from an ad, keep it with them, and attach it to
the payment. Then revenue has a campaign on it and every one of the six questions is a `group by`.

```
  Ad click                 Landing page              Checkout                Our database
  ────────                 ────────────              ────────                ────────────
  Meta / Google ad   →     pixel reads the URL   →   Paystack charge   →     purchase_events
  URL carries utm_*        mints bg_cid,             carries bg_cid          carries bg_cid
  and gclid/fbclid         stores it first-party,    in metadata                    │
                           sends a touchpoint                                        ▼
                                  │                                          attribution resolver
                                  ▼                                                 │
                            sdk_events (touchpoint)  ──────────────────────────────► │
                                                                                     ▼
                                                                        attributed_conversions
                                                                                     │
                                                                                     ▼
                                                                          channel_daily (view)
                                                                     spend + revenue in one row
```

### Why this works here and not just in theory

- **Paystack and Flutterwave take arbitrary metadata on a transaction** and hand it back on the
  webhook we already verify. One field in the brand's existing checkout call carries `bg_cid`.
  That is the only line of code we ever ask a customer to write, and section 7 removes even that
  for most brands.
- **Meta and Google both do the tagging for us.** We already hold `ads_management` and the full
  `adwords` scope. Section 7.
- **Google auto-tagging puts `gclid` on every click with no URL work at all.** Meta puts `fbclid`
  on most. The pixel can read both and resolve them back to a campaign.
- **The offline side already redirects through `/go/[slug]` and appends UTMs**, so a billboard and
  a Meta ad arrive at the landing page looking the same to the pixel. OOH and print come along
  for free.

### The match ladder, with honesty built in

The resolver tries each rung in order and records which one it used. Nothing is ever guessed
silently.

| Rung | Method | Confidence | Recorded as |
|---|---|---|---|
| 1 | `bg_cid` present in the payment metadata | Deterministic | `matched_click` |
| 2 | `session_id` on a touchpoint and on the payment | Deterministic | `matched_session` |
| 3 | Payment email equals an email captured in a touchpoint (lead, signup, newsletter) | Strong | `matched_identity` |
| 4 | Email hash matches, same device family, inside the attribution window | Probable | `matched_window` |
| 5 | Nothing matched | None | `unattributed` |

Rung 5 is a feature, not a failure. It is the answer to question 6, and it is the number most
attribution products hide. We show it on the same screen as the rest.

### Attribution models

Store the touchpoint path once, then resolve a model over it. First build **last non-direct paid
touch** as the default, because it is what Nigerian marketers already expect from Meta and GA4,
and it is the easiest to explain. Keep the path so **first touch** and **linear** are a dropdown
later, not a rebuild. Default window: 7-day click, 1-day view, settable per brand.

Every figure shows its model and its window on the screen. A number without those two labels is
not a number.

## 6. The data model

Four changes. Additive, nothing rewritten.

```sql
-- supabase/migrations/2026XXXXXXXXXX_revenue_attribution.sql

-- 1. Teach the existing event stream about campaigns.
alter table sdk_events
  add column if not exists bg_cid       text,
  add column if not exists session_id_v2 text,
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content  text,
  add column if not exists utm_term     text,
  add column if not exists click_id     text,   -- gclid / fbclid / ttclid
  add column if not exists click_source text,   -- which of the three
  add column if not exists landing_path text,
  add column if not exists email_hash   text;  -- sha256, never the address

create index if not exists idx_sdk_events_bg_cid on sdk_events(brand_id, bg_cid)
  where bg_cid is not null;

-- 2. Teach revenue about the click.
alter table purchase_events
  add column if not exists bg_cid     text,
  add column if not exists session_id text,
  add column if not exists email_hash text;

-- 3. The identity spine: one row per visitor, per brand.
create table if not exists visitor_identities (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  bg_cid          text not null,
  email_hash      text,
  phone_hash      text,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  first_touch     jsonb default '{}',  -- utm set + click id of the first paid touch
  last_touch      jsonb default '{}',
  touch_count     integer not null default 1,
  created_at      timestamptz not null default now(),
  unique (brand_id, bg_cid)
);

-- 4. The resolved ledger. One row per conversion, with its method and model.
create table if not exists attributed_conversions (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references brands(id) on delete cascade,
  purchase_event_id uuid references purchase_events(id) on delete cascade,
  conversion_type   text not null check (conversion_type in ('purchase','signup','lead','booking')),
  revenue           numeric(14,2),
  currency          text default 'NGN',
  channel           text,          -- paid_social | paid_search | ooh | influencer | email | organic | direct | referral
  platform          text,          -- meta | google | tiktok | linkedin | twitter
  campaign_id       text,          -- platform campaign id, joins digital_performance_daily
  campaign_name     text,
  adset_id          text,
  match_method      text not null check (match_method in
                      ('matched_click','matched_session','matched_identity','matched_window','unattributed')),
  confidence        text not null check (confidence in ('deterministic','strong','probable','none')),
  model             text not null default 'last_paid_click',
  window_days       integer not null default 7,
  touch_path        jsonb default '[]',  -- the full ordered path, so another model is a re-read
  occurred_at       timestamptz not null,
  resolved_at       timestamptz not null default now(),
  unique (purchase_event_id, model)
);

alter table visitor_identities     enable row level security;
alter table attributed_conversions enable row level security;

create policy visitor_identities_workspace on visitor_identities for all
  using (is_workspace_member((select workspace_id from brands where id = brand_id)));
create policy attributed_conversions_workspace on attributed_conversions for all
  using (is_workspace_member((select workspace_id from brands where id = brand_id)));
```

Then one view that does all the arithmetic in one place, so no screen can disagree with another:

```sql
create or replace view channel_daily as
select
  s.brand_id,
  s.date,
  s.channel,
  s.platform,
  s.campaign_id,
  s.campaign_name,
  s.spend,
  s.impressions,
  s.clicks,
  s.platform_conversions,
  coalesce(r.revenue, 0)      as attributed_revenue,
  coalesce(r.conversions, 0)  as attributed_conversions,
  coalesce(r.new_customers,0) as attributed_new_customers,
  case when s.spend > 0 and r.revenue    > 0 then r.revenue / s.spend end          as roas,
  case when r.conversions  > 0            then s.spend / r.conversions end          as cost_per_conversion,
  case when r.new_customers > 0           then s.spend / r.new_customers end        as cac
from spend_daily s
left join revenue_daily r using (brand_id, date, campaign_id);
```

`spend_daily` and `revenue_daily` are thin views over `digital_performance_daily` and
`attributed_conversions`. Every module reads `channel_daily`. Nothing recomputes ROAS in a
component, the same discipline the Desk already follows with its one data layer.

Privacy: the pixel sends an email **hash** and never the address. `purchase_events` already holds
the real email because Paystack sends it and the brand owns that relationship, so matching
happens on the hash and the raw address never leaves the webhook path. NDPR consent language for
the pixel goes in the install screen.

## 7. The part that removes the manual effort

This is the difference between a feature marketers use and a feature marketers abandon. Three
pieces.

### 7.1 One-click campaign tagging (the cornerstone)

We already hold `ads_management` on Meta and the full `adwords` scope on Google. So BrandGauge
can write the tracking parameters itself:

- **Meta:** set `url_tags` at the ad or adset level through the Marketing API. One PATCH per ad,
  and `utm_source=meta&utm_campaign={{campaign.name}}&bg_cid={{ad.id}}-{{...}}` lands on every
  future click. No creative is re-uploaded and no URL is retyped.
- **Google:** switch on auto-tagging at the account level and read `gclid`, plus set the account
  tracking template. Google then tags every click whether or not anyone remembers to.
- **Offline:** already done. `/go/[slug]` appends UTMs today.

The UI is one screen: *Connect your ad account, then press "Tag my campaigns".* It shows which
campaigns are tagged, which are not, and tags the untagged ones. A nightly job tags anything new
so a campaign launched on Friday is tracked by Saturday. Nobody builds a UTM by hand, ever.

### 7.2 Checkout detection instead of checkout instructions

Asking a brand to add `bg_cid` to their Paystack call is one line of code, but it is still a
developer ticket, and a developer ticket is where adoption dies. So:

- The pixel **auto-detects** Paystack and Flutterwave inline checkout on the page and wraps the
  call to inject `metadata.bg_cid` with no code change by the brand. Both SDKs attach a known
  global, so this is a documented wrap, not a hack.
- When that is not possible, rung 2 and 3 of the ladder carry it: the pixel already has the
  session and, on most checkouts, the email. We get deterministic or strong matching without
  touching the brand's code.
- The copy-paste snippet with `bg_cid` stays in the docs for teams who want the cleanest signal.

Honest framing on the install screen: one script tag gets you channel revenue. A payment
connector gets you naira instead of counts. The one line in checkout moves you from strong to
deterministic.

### 7.3 Auto-fed budget actuals

`budget_actuals` is typed by hand today, which is why question 5 goes stale. A nightly job writes
real spend into the line item when the line item is linked to a channel or a campaign, marked as
a connector-sourced actual so a manually entered figure is never overwritten. Same conditional
discipline as `commercial-metrics-rollup.ts`: no source, no write.

That turns "which campaigns are approaching their budget" from a question about data entry into a
question about data.

## 8. What each brand gets, honestly, at each step

No brand should hit a wall. Each connection adds a row of answers and the product says which row
you are on.

| Connected | Questions answered | Precision |
|---|---|---|
| Nothing | None | We say so, and say what to connect |
| GA4 only (one OAuth click) | 1, 2 partly, 6 | Channel-level revenue and ad cost straight from GA4's own model. No campaign depth, no CAC |
| Ad accounts only | 3, 5, and cost per platform conversion | Platform-reported, labelled as such |
| Ad accounts + pixel | 1, 2, 3, 5, 6 | Our own attribution, counts and conversions, channel and campaign depth |
| Ad accounts + pixel + Paystack or Flutterwave | All six | Naira revenue, real CAC, deterministic matching |

GA4 as step one matters. Section 4.3 is a half-day fix that pulls `sessionDefaultChannelGroup`,
`sessionSource`, `sessionMedium`, `sessionCampaignName` against `purchaseRevenue`, `sessions`,
`conversions` and `advertiserAdCost`, into a proper dated table. That alone answers question 1
and question 6 for any brand with GA4 ecommerce already set up, on the day we ship it, with no
pixel and no tagging. It is the cheapest honest win in this document.

### Not every brand sells online

`brand_type` has to branch, as it does everywhere else in this codebase. An FMCG or
`b2b_distribution` brand has no on-site checkout, so paid-channel ROAS is the wrong question for
them and we must not fake it:

- **fintech, b2b_saas, marketplace:** the full ladder. Signup and first payment are the
  conversions. CAC and LTV:CAC are already visible for these three in `commercial-metrics.ts`.
- **venue, beverage_alcohol:** bookings and vanity-link visits are the conversion. Revenue comes
  from Paystack where it exists, otherwise the honest answer is cost per booking.
- **fmcg, b2b_distribution:** no per-customer attribution. They get spend, reach, vanity-link
  response, search uplift and geo-lift, which is what `geo-lift-study.ts` and
  `ooh-search-uplift.ts` already do. The attribution screens stay hidden for them rather than
  showing an empty state, the same way `visibleCommercialMetrics` hides CAC today.
- **agency:** the dimension is the client, not the brand. Their `total_spend` is client media
  spend, so ROAS on it would mislead. Deferred until multi-client reporting is designed.

## 9. Features to build

Nine items. Sized for one developer working with Claude, assuming no new credentials are needed,
because none are.

**P0: clear the ground (about 3 days)**

| # | What | Where | Size |
|---|---|---|---|
| 1 | Fix the pixel loader: absolute endpoint, generate and persist a session id, enforce `allowed_origins` | `/api/sdk/pixel.js`, `/api/sdk/event` | 0.5 day |
| 2 | Pull conversion value from both ad platforms so `roas` and revenue are real | `meta-ads-daily-sync.ts` (`action_values`, `purchase_roas`), `google-ads-daily-sync.ts` (`conversions_value`) | 1 day |
| 3 | Rewrite the GA4 sync: dimensions, revenue, ad cost, a dated table, and token refresh | `ga4-daily-sync.ts`, new `ga4_channel_daily` | 1 day |
| 4 | Fix or relabel MMM. Read real digital spend, stop adding conversion value into spend, drop the invented lead value, and mark the contribution chart as activity share and not ROI | `/api/mmm/run/route.ts` | 0.5 day |

**P1: the spine (about 2 weeks)**

| # | What | Where | Size |
|---|---|---|---|
| 5 | The migration in section 6, plus the `channel_daily` view | new migration | 1 day |
| 6 | Pixel v2: read UTMs and `gclid`/`fbclid`/`ttclid`, mint and persist `bg_cid` first-party, hash emails, send touchpoints, auto-detect Paystack and Flutterwave checkout | `/api/sdk/pixel.js`, `/api/sdk/event` | 3 days |
| 7 | The attribution resolver as an Inngest job: walk the match ladder, build the touch path, write `attributed_conversions`, reconcile the last 7 days each night so a late webhook is not lost | new `attribution-resolver.ts`, plus a hook on the two payment webhooks for immediate resolution | 4 days |
| 8 | One-click campaign tagging for Meta and Google, plus the nightly catch-up | new `/api/ads/*/tagging` routes, new Inngest job, one settings screen | 3 days |
| 9 | Auto-fed budget actuals from connected spend | new Inngest job, `budget_line_items` gets a `source` column | 1 day |

**P2: the screens (about 1 week)**

A new dashboard module, **Revenue & Attribution**, at `/dashboard/attribution`. It needs a
`src/lib/modules.ts` entry and a product tour with `data-tour` attributes, per the definition of
done. Five panels, each one answering a question by name:

1. **Revenue by channel.** Stacked by channel over time, with the unattributed share as an
   explicit band and not a gap. Answers 1 and 6.
2. **Campaign league table.** Spend, attributed revenue, ROAS, CPA, CAC, conversions, sorted by
   ROAS, with the model and window in the header. Answers 2 and 4.
3. **Spending without return.** Campaigns above a spend floor with zero attributed conversions in
   the window, ranked by naira at risk. Answers 3. This is the panel that pays for the project.
4. **Budget pacing**, moved in from `/dashboard/budget` and now fed automatically. Answers 5.
5. **Match quality.** What share of revenue was deterministic, strong, probable or unattributed,
   and the one next step that would improve it. This is what makes the module trustworthy.

## 10. Upgrades to existing features

The point of the spine is that it improves modules already built, not just the new one.

- **Digital (`/dashboard/digital`).** ROAS stops being blank or random. Each number gets a label
  saying whether it is platform-reported or BrandGauge-attributed. The two are allowed to differ
  and the screen should explain why in a line.
- **Budget.** Actuals arrive on their own. Pacing becomes live rather than as fresh as the last
  time someone typed.
- **Campaign targets.** New metrics become targetable: attributed ROAS, CAC, attributed revenue.
  The off-track alert in `campaign-target-monitor.ts` already carries them with no change to the job.
- **Business Case and Board Pack.** Both read `commercial-metrics.ts` today, which is brand-level.
  Give them channel and campaign detail so a board-grade case can say which channel earned the
  money instead of only how much came in.
- **MMM.** With real per-channel spend and real attributed revenue, the top-down model finally has
  something to be checked against. Keep MMM for the channels attribution cannot see, which is TV,
  radio and OOH, and show the attributed figure beside the modelled one. That contrast is a
  genuinely good screen and it is honest about which is measured.
- **Funnel.** The Unified Funnel can show where in the funnel each channel contributes, not just
  aggregate stage counts.
- **CDP.** `acquisition_source` is limited to `survey | whatsapp | app_review | manual` today. Add
  the paid channel and the campaign from `visitor_identities`, which makes per-segment CAC possible.
- **Free Tools.** The campaign audit can tell a visitor whether their own site is even tagged, which
  is a strong reason to sign up and costs nothing to check.
- **Ask / AI Command Layer.** Once `channel_daily` exists, all six questions become answerable in
  natural language from one view. This is the cheapest feature in the document and the one that
  will demo best.

## 11. Rules we hold to

Non-negotiable, and they are what will make marketers believe the numbers.

- **Every figure carries its origin.** We already do this for influencer metrics with
  `metric_sources` (`pulled | entered | estimated`) and for the free tools with `observed |
  estimated | interpreted | recommended`. Attribution follows the same discipline: the match
  method and the model are stored on the row and shown on the screen.
- **Never invent a number.** No modelled conversion rate, no assumed order value, no synthetic
  revenue. If a brand has counts and not naira, we report counts and say why.
- **Unattributed is shown, never hidden.** Burying it is how attribution products lose trust.
- **Platform-reported and BrandGauge-attributed are labelled separately** and never added together.
- **One place does the arithmetic.** `channel_daily` and one lib module, the way the Desk keeps
  one data layer. No ROAS computed in a component.
- **No new credentials.** Everything here runs on connectors we already have, with scopes already
  granted. Nothing in this plan becomes Inert on a missing key.
- **Branch on `brand_type`.** An FMCG brand never sees a paid-channel ROAS screen that cannot
  mean anything for them.
- **Hashes, not addresses.** The pixel never sends a raw email.

## 12. The six questions, answered

What the queries look like once this is in. All six come off one view.

```sql
-- 1. Which channels generate the most attributed revenue?
select channel, sum(attributed_revenue) from channel_daily
where brand_id = $1 and date >= $2 group by channel order by 2 desc;

-- 2. Which campaigns have the strongest ROAS?
select campaign_name, sum(spend), sum(attributed_revenue),
       sum(attributed_revenue) / nullif(sum(spend), 0) as roas
from channel_daily where brand_id = $1 and date >= $2
group by campaign_name having sum(spend) > 0 order by roas desc nulls last;

-- 3. Which campaigns spend without producing eligible conversions?
select campaign_name, sum(spend) as wasted
from channel_daily where brand_id = $1 and date >= $2
group by campaign_name
having sum(spend) > $3 and sum(attributed_conversions) = 0
order by wasted desc;

-- 4. CAC per paid channel?
select channel, sum(spend) / nullif(sum(attributed_new_customers), 0) as cac
from channel_daily where brand_id = $1 and date >= $2 group by channel;

-- 5. Which campaigns are approaching or exceeding budget?
--    Already answerable. After item 9 the actuals arrive without anyone typing.

-- 6. How much revenue cannot be attributed to a paid campaign?
select match_method, sum(revenue), 100.0 * sum(revenue) / sum(sum(revenue)) over () as pct
from attributed_conversions where brand_id = $1 and occurred_at >= $2
group by match_method;
```

## 13. Realistic timeline and what it costs

| Phase | Work | Calendar |
|---|---|---|
| P0 | The four fixes in section 4 | 3 days |
| P1 | Spine: migration, pixel v2, resolver, tagging, budget feed | 2 weeks |
| P2 | The Revenue & Attribution module and the upgrades in section 10 | 1 week |
| | **Total** | **about 3.5 weeks of focused work** |

Cost: nothing new. No paid data provider, no new API, no credential we do not hold. The AI spend
is unchanged because none of this needs a model to compute. The only ongoing cost is the pixel
write volume into `sdk_events`, which wants a retention policy like the one
`tool-run-retention.ts` already does for tool runs.

The honest risk, stated plainly: match rates in the real world are 60 to 85 percent with a
first-party pixel and a payment connector, lower on iOS Safari. That is why the unattributed band
and the match-quality panel are built in from the first day rather than added when someone asks.
A product that reports 70 percent matched and says so beats one that claims 100 percent and
quietly rounds.

## 14. Decisions needed before building

1. **Default model.** Proposal: last non-direct paid click, 7-day click and 1-day view window,
   with first touch and linear as a later dropdown. Confirm.
2. **Does P0 ship on its own?** It is 3 days and it stops the product showing random ROAS. I would
   ship it this week regardless of whether P1 is approved.
3. **MMM: fix or relabel?** I recommend relabelling it as a media activity share chart now, dropping
   the ROI figure entirely, and rebuilding it as a real model only after attribution gives us
   something to calibrate against.
4. **GA4 first?** The GA4 rewrite alone answers questions 1 and 6 for brands that already have GA4
   ecommerce. It could ship inside P0 as the cheapest honest answer, before the spine exists.
5. **Does `/dashboard/attribution` become a new module or extend `/dashboard/digital`?** I prefer a
   new module, because it covers offline and organic too, and `digital` should stay about paid media.
