# Spec: The Monday Brief

**Status:** Draft, 3 November 2026 · **Owner:** Emmanuel · **Size:** about 1 week to build

## The promise

> **Know why your numbers moved.**
> BrandGauge puts your campaigns, your market and your results side by side, so you can see how your brand and marketing are performing, and why.

Every Monday, each brand gets one short answer: *what moved last week, and what probably moved it.*

## Why

Marketers track results in one tool, social in another, competitors in a third and research in a fourth. So "why did signups drop?" gets answered in a meeting, from memory. The Monday Brief is the joined-up answer, and it works on day one without the brand connecting anything.

## How it works: three inputs, one answer

| Input | What it is | Where it comes from | Login needed? |
|---|---|---|---|
| **1. Your results** | 1 to 3 weekly numbers: new accounts, installs, sales | The weekly check-in (below) | No |
| **2. What you did** | Campaigns, plus "moments": launches, price changes, PR, outages | Campaigns module (exists) + a quick "Add a moment" | No |
| **3. What the market did** | Press, competitor moves, app releases, X | Built and fixed this week | No |

**The weekly check-in.** Every Monday the dashboard home asks: "How many new accounts did you get last week?" One box, ten seconds. The questions follow the brand type: fintech is asked for accounts, FMCG for sales, and so on. A brand that would rather not share real figures can enter an index (last week = 100). It saves to the existing `metric_manual` table, so no new schema is needed. A reminder email goes out if Monday passes with nothing entered.

**The answer.** One AI read per brand per week, with every claim labelled:

- **Moved together:** happened in the same window. This is the default label.
- **Tested:** proven by a lift test or A/B test in BrandGauge.
- **No clear cause:** said plainly, never guessed.

Example: *"Signups fell 12% (3,710, down from 4,210). In the same week, Moniepoint launched a zero-fee promo (TechCabal, 28 Oct) and your Lekki billboard flight ended. Moved together, not tested."*

## Rules (learned the hard way this week)

1. **No story from no data.** With fewer than 2 weeks of numbers, the brief asks for them instead of writing anything.
2. **Never claim a share of revenue or a cause without a test.** No "OOH drove 18%".
3. **Every claim links to its source:** the check-in, the campaign, or the article.
4. **It goes to the brand's own team.** Owners and admins, through the email routing fixed on 3 November.

## Where it shows up

- **Dashboard home:** the brief at the top, the check-in box under it. Every onboarding goal leads here.
- **Email, Monday 9am Lagos:** the brief, plus a link to the full page.
- **A share link:** read-only and no login, so a marketer can forward it to their boss. This reuses the Client Portal's links. It's also how BrandGauge spreads.
- **Not WhatsApp yet.** That waits for the dedicated number and the Meta Cloud API. See below.

## Not in this version

- WhatsApp check-ins or delivery.
- CSV upload. Brands said they won't share raw data.
- Revenue attribution percentages.
- Any new connector. Connected data makes the brief sharper but is never required.

## Build order

1. **Weekly check-in** on the home page, with the index option and the Monday reminder email. *1 to 2 days.*
2. **"Add a moment"**: a new `brand_moments` table, with RLS, and a quick-add on the home page. *1 day.*
3. **Brief job:** an Inngest job every Monday at 08:00 Lagos that gathers the three inputs, makes one structural-tier AI call, applies the rules above, and caches the result. *2 days.*
4. **Home page, email and share link.** *1 to 2 days.*

## How we'll know it works

- **Habit:** at least half of active brands enter their number 4 Mondays in a row.
- **Value:** the share link is opened by someone other than the brand's own team, meaning it was forwarded.
- **Truth:** in the first 10 briefs, the brand manager agrees the "why" was right, or at least worth checking.

## Separate cleanup: survey WhatsApp

Survey panels still try to send WhatsApp through Africa's Talking. It isn't connected, it's too expensive, and the project rules ban it. Remove that path. Surveys go out by email and share link until BrandGauge has its own WhatsApp number on the Meta Cloud API.

## Open questions for Emmanuel

1. Which 1 to 3 weekly numbers should each industry be asked for? I'll propose defaults by brand type.
2. Monday 9am, or Monday 7am, before the team's weekly meeting?
