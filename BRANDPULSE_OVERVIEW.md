# BrandPulse AI — A Complete Guide

## Opening

BrandPulse AI is a brand intelligence platform built for Nigerian and West African marketing teams. It collects data from every place a brand shows up — social media, billboards, app stores, ad campaigns, field reports, surveys, and AI assistants — turns that data into a single score, and then helps teams understand what is driving that score up or down.

The people it serves are brand managers, CMOs, and marketing leads at consumer companies in Nigeria. They spend money across channels that are difficult to connect: a radio ad in Abuja, a billboard in Lekki, a Meta campaign running across the country, a product activation at a supermarket in Ibadan. Before BrandPulse, measuring the effect of any of this required commissioning separate trackers, paying research agencies, waiting weeks for data, and then manually assembling the story. Most teams did not bother.

Africa presents two specific problems that global tools ignore. First, the cultural context matters enormously. Brands that land in Lagos do not automatically land in Kano. Sentiment that reads as sarcastic in English may be affectionate in Pidgin. A campaign that resonates during Ramadan needs a different read during the Christmas season. Second, a large share of brand activity happens offline. More than half the marketing budget at a typical Nigerian FMCG company goes to out-of-home advertising and field activations — channels that Google Analytics cannot track. BrandPulse was built to handle both.

---

## The Core Idea: Brand Health Index (BHI)

Every screen in BrandPulse feeds a single number called the Brand Health Index, or BHI. The score runs from 0 to 100 and sits in one of four zones: At Risk (below 40), Building (40 to 65), Healthy (65 to 80), and Leading (above 80). The zones are not cosmetic. They are calibrated against real Nigerian market data — sector benchmarks derived from 2024–2025 industry reports. A score of 52 is average for FMCG. A score of 47 is average for fintech. Knowing where you sit in your own category is what makes the number useful.

The full BHI has seven components. Each one captures a different dimension of brand strength.

**Awareness (20%)** measures how many people could have encountered the brand. It is a composite of five inputs: social share of voice, OOH billboard reach, event attendance, digital ad impressions, and influencer reach. A brand running no outdoor advertising or events will only be scored on what is available. Missing signals reduce the coverage percentage but do not drag the score to zero — the weights redistribute automatically.

**Salience (15%)** measures how many people, when asked directly, recognise the brand. This comes from awareness-check surveys run inside the platform. It is the difference between a brand that saturates the market and one that people actually remember.

**Sentiment (20%)** is the daily volume-weighted blend of how people feel about the brand on social media. It is calculated from mentions on X and Instagram, classified by AI, and aggregated per day. Positive, neutral, and negative percentages are stored, along with per-platform breakdowns. The emotion layer goes further — it tracks which specific emotions (joy, anger, trust, anticipation) are showing up in the mentions.

**Perception (15%)** comes from structured surveys. The platform's Perception Audit survey asks respondents to rate the brand on eight dimensions: Quality, Trust, Innovation, Value, Cultural Relevance, Accessibility, Reliability, and Emotional Connection. The average rating across those dimensions, normalised to a 0–100 scale, feeds this component.

**Cultural Resonance (15%)** is the score that sets BrandPulse apart. It measures how well the brand's content and campaigns land culturally — does it feel Nigerian, or does it feel imported? The score feeds from Pre-Post Analysis results (see the Creative section below) and is calibrated to capture whether content connects with the values, humour, and references that resonate in West Africa.

**Blended SOV (10%)** is social share of voice: the percentage of total category conversation on social media that belongs to the brand, compared to tracked competitors.

**Earned Media Value (5%)** estimates the monetary value of organic social engagement. It applies a Nigerian market CPM rate of ₦500 per 1,000 impressions and a CPE rate of ₦50 per engagement, then normalises the result to a 0–100 scale against a ₦10M benchmark.

The weights are not fixed. BrandPulse ships with seven preset weight profiles, one per industry vertical. For a fintech company, trust matters more than cultural resonance — so Sentiment jumps to 25% and Cultural Resonance drops to 5%. For a restaurant or venue, Perception (what people say in reviews) gets 25% because reviews drive footfall. For a B2B SaaS company, G2-style perception and LinkedIn share of voice matter most, so Cultural Resonance drops to zero entirely. Each preset is a deliberate model of what actually drives brand strength in that category, not a generic one-size-fits-all formula.

---

## The Full Feature Set

### Brand Equity Tracker

The Brand Equity page is the deepest view of the BHI. It shows the full 7-component score with a drill-down into each component's data sources, a sparkline of BHI over time, current NPS from survey responses, Earned Media Value in naira, and a perception radar plotting the eight survey dimensions as a web chart.

Three specialised panels appear depending on brand type. For venue brands (restaurants, hotels, stadiums), a Venue Reputation panel pulls the Google Maps rating and review velocity, sourced via the Google Maps API. For fintech brands, a Trust Pillar card computes a separate trust score from four inputs: app store rating, regulatory standing (clean, under review, sanctioned), reliability signal, and recent complaint surge count. For fintech, B2B SaaS, and marketplace brands, a Developer Health panel surfaces GitHub stars, npm weekly downloads, and Stack Overflow question volume — useful signals for brands with developer audiences.

Any brand can add Launch Markers, which are date-stamped annotations (product launch, campaign start, crisis event) that overlay the BHI sparkline so the team can see exactly what caused a score to move.

### Sentiment

The Sentiment module shows what people are saying about the brand on X and Instagram. A nightly job runs at 4am Lagos time, pulls recent mentions using the connected social accounts, runs each mention through AI classification to assign sentiment label and emotion tags, and aggregates the results per day.

The dashboard shows the current sentiment score, percentage positive, percentage negative, and raw mention count. Below the KPI tiles, a weekly trend chart plots score, positive share, and negative share over time. A calendar heatmap stretches back up to 13 months, showing sentiment by day across a GitHub-contribution-style grid. There is a platform breakdown panel showing X and Instagram separately, and an emotion wheel showing the distribution of classified emotions (joy, trust, anger, fear, and so on) across the selected window.

BrandPulse also shows who is talking — whether mentions come from consumers, creators, developers, trade partners, or media. This audience segmentation is a useful early signal for whether a brand's messaging is reaching its intended audience.

Alerts surface automatically. A sentiment crash of 20 points in a single day triggers a critical alert. A sustained stretch of more than 60% negative mentions for three days triggers a warning. Every alert has a "Find out why" button that pre-fills the AI command layer with an investigation question.

### Competitive Intelligence

The Competitive module answers one question: how does this brand compare to its rivals? The SOV snapshot shows the brand's social share of voice against each tracked competitor, computed from the same mention data that feeds the sentiment pipeline. A weekly AI briefing — generated every Monday at 8am Lagos time and emailed to the team — reads the latest SOV snapshot, sentiment trend, and recent mentions, then produces a narrative summary with observations and recommended actions.

The Competitor Sightings feed is a manual intelligence layer. Team members and field officers can log sightings of competitors in the wild: a new billboard in Ikeja, a product activation in a mall, a PR campaign in a newspaper. Sightings are timestamped, geocoded (state and city), and categorised by type (billboard, event, digital, print, TV, radio, activation, PR). Over time, this builds a picture of where rivals are investing.

### Cultural Resonance

The Cultural page surfaces one key metric: the brand's average Cultural Score derived from pre-post content analyses. It also shows Emotion Resonance — the share of all mention emotion that falls into the positive emotions of joy, trust, and anticipation — and a Drift figure that compares the last seven days against the prior period.

The cultural profile is configured at the brand level using five sliders: community vs. corporate, traditional vs. modern, religious vs. secular, mass vs. premium, and local vs. global. These sliders inform the AI's cultural scoring of content. A brand positioned as "mass, traditional, community" will be scored differently on content than a brand positioned as "premium, modern, global."

### Influencer Tracker

The Influencer module manages a roster of creators. Each influencer has a handle, platform, follower count, category, and two AI-computed scores: Cultural IQ (how well this creator's content and audience aligns with Nigerian cultural values relevant to the brand) and Risk Score (reputational risk based on past controversy or brand-unsafe content patterns). Influencers move through statuses: prospect, active, paused, rejected.

Influencer campaigns are tracked separately, with reach, impressions, engagements, EMV, and fees recorded per campaign. The platform computes net return by comparing EMV and attributed clicks and conversions against the fees paid.

### Creative Performance

Creative Analysis is a four-mode AI tool for reviewing brand content. In Compare mode, the team pastes two versions of an ad or social post and the AI returns a side-by-side breakdown covering engagement potential, cultural resonance, tone, clarity, and recommended winner. In Brand Voice mode, it checks whether a piece of content matches the brand's defined values and voice. In Competitor mode, it analyses a competitor's creative and identifies strengths and vulnerabilities.

The Pre-Post widget is a keyboard-shortcut-accessible overlay (Cmd+Shift+P) that scores content on five dimensions before it goes live: engagement, cultural resonance, tone, clarity, and risk. It returns a verdict, specific improvements, and an optional suggested rewrite. Every analysis is stored, so the team can review the history of what was checked and whether the scores improved.

### OOH and Outdoor Advertising

OOH Intelligence tracks every outdoor advertising site the brand is running. Each site has a location (state, LGA, GPS coordinates), format type (billboard, bus shelter, LED screen, etc.), daily traffic estimate, monthly cost, campaign dates, and a photo.

Attribution is handled with branded vanity links. When a site is created, the platform generates a short URL (e.g., `go.brandpulse.ai/lekki-jul`) that maps to the landing page. The brand prints this on the billboard. Every scan or typed visit is counted and attributed to that specific site. QR codes are available as a secondary option.

The Geo-Lift Study tool takes this further. It compares search volume for brand-related terms in the city where the billboard is running (treatment) against a matched city that saw no OOH activity (control). The comparison produces a lift percentage and confidence score, answering the question: did the billboard actually move anything?

### Events and Activations

The Events module manages brand activations, sponsorships, and consumer events from planning through to ROI report. Each event has a budget, expected attendance, activation type, and city.

Field ambassadors use a Progressive Web App (PWA) to capture interactions live. Each interaction is timestamped and categorised (product sample, demo, conversation). The PWA also runs intercept surveys with consenting attendees. When an event is closed, an Inngest job fires automatically, computes all metrics (interactions per ambassador, lead capture rate, cost per interaction), and generates an AI narrative ROI summary.

### Brand Funnel

The Brand Funnel page visualises the full consumer journey from awareness to advocacy. It pulls data from every connected source and maps each stage: Awareness (SOV, OOH reach, digital impressions, event attendance, press mentions), Consideration (content engagement, influencer reach, survey-based consideration scores), Purchase (transactions from Paystack/Flutterwave webhooks, ecommerce sales imports, SDK conversion events), Retention (loyalty programme transactions, NPS scores, repeat purchase signals), and Advocacy (active promoters, referral events, user-generated content).

Each stage shows a composite score and the data sources that fed it. The AI Funnel Diagnostic reads the stage scores and identifies where the biggest drop-off is, then explains what likely caused it and what to do about it.

### Surveys and Panels

BrandPulse has a built-in survey engine. Teams can create surveys from scratch or use templates: Perception Audit (the 8-dimension brand questionnaire), Awareness Check, NPS, B2B Intercept, and Product Launch tracker. Surveys are distributed by email, in-app, WhatsApp, or shareable link.

Survey Panels automate the distribution. A panel is a recurring schedule (monthly or quarterly) that sends a survey template to a configured list of recipients and creates a new survey instance automatically. The AI NPS Diagnosis reads the open-text responses from NPS surveys and identifies the top themes driving promoters vs. detractors.

### Field Teams

The Field Intelligence module receives reports from field sales officers (FSOs). Each report covers a set of outlets visited: whether the product was on shelf, stock level (adequate, low, out of stock), whether POS materials were present and in good condition, competitor activity observed, and the price the brand was selling at in that outlet. Reports are linked to FSO teams, and the dashboard shows availability percentages, POSM condition scores, and a state/LGA breakdown of where the brand is and is not present.

### AI Command Layer

The Ask AI interface is the brain of the product. It is a multi-turn chat where the question is answered using the brand's live data — not general internet knowledge. Before each response, the system builds a context snapshot: current BHI score, recent sentiment trend, latest SOV, NPS, active campaigns, and upcoming events. Claude Sonnet reads this snapshot and answers in plain English, citing which data sources it used and rating its own confidence as High, Medium, or Low. If a piece of data is missing, the AI says so and recommends what to collect.

Three additional tools sit alongside the chat. The Monthly Report tab generates a full narrative brand report for the previous 30 days, covering all major metrics with observations and recommended priorities. The Business Case tab generates a board-grade investment brief — this is the one place in the product that escalates to Claude Opus, the most capable model, because business cases get presented to boards and need to be held to a higher standard. The Funnel Diagnostic tab reads the funnel stage scores and produces a structured analysis of where the marketing is and is not working.

### Retention and Advocacy

The Retention module surfaces customer churn risk. It identifies customers showing early warning signs — declining engagement, dropping NPS, reduced purchase frequency — and flags them for intervention. WhatsApp outreach (built but held back until a dedicated business number is configured) can be triggered directly from this view.

The Advocacy module tracks the brand's promoter programme. Customers who score 9 or 10 on NPS are candidates for the programme. Active promoters get referral codes, and their attributed conversions are tracked. The Advocacy Dashboard shows the total number of active promoters, total referral events, and the overall advocacy score.

### Connectors

The Connectors hub is where all data sources are wired up. Social listening uses OAuth-connected X and Instagram accounts. Web analytics connects through GA4 OAuth, pulling sessions, users, page views, bounce rate, and conversion events daily. Digital advertising connects through Meta Ads OAuth, syncing campaign spend, impressions, reach, clicks, CTR, CPC, CPM, ROAS, and video view rates daily.

Payment webhooks from Paystack and Flutterwave feed the purchase stage of the funnel. App Store and Play Store apps are linked by entering an Apple App ID or Google package name — the platform then polls both stores for ratings, review counts, and recent review text. Email marketing platforms (Mailchimp and Brevo) connect via API key to sync subscriber and engagement data. The SDK pixel is a lightweight JavaScript snippet that brands embed on their websites or apps to fire custom brand interaction events directly into BrandPulse.

---

## Background Intelligence

BrandPulse runs a fleet of scheduled background jobs through Inngest, a durable workflow platform that retries failed jobs and provides a full execution log.

Every night at 4am Lagos time, the mention crawler pulls the last 24 hours of X mentions for every connected brand, runs them through sentiment classification, and updates the daily sentiment aggregate and SOV snapshot. At 5am, Meta Ads data syncs. At 6am, GA4 data syncs. At 8am, the volume surge check fires — it looks at whether yesterday's mention count was more than two standard deviations above the rolling average, and if so, creates a notification alert. At 9am, Google Maps pulls updated ratings for all venue brands.

Every Monday at 8am, the Competitive Weekly Briefing runs for every brand, generates an AI narrative summary using the latest SOV, sentiment, and sighting data, and emails it to the team. Every Monday at 9am, the AI Visibility tracker fires — it generates five category questions that a Nigerian consumer might type into an AI assistant, submits them to ChatGPT, Gemini, and Perplexity (whichever API keys are configured), and records whether the brand was mentioned and in what tone. The weekly score is a weighted measure of mention rate, position (early mentions score higher than late ones), and tone. On the first of every month at 7am, monthly brand reports are generated and emailed.

Other jobs run on demand: the App Store review sync, the event ROI report (triggered the moment an event is closed), the WhatsApp broadcast (triggered by campaigns), and the panel dispatch (triggered when a survey panel's next run date arrives).

---

## The AI Layer

AI runs through every part of the product, but it does not all run the same model. BrandPulse uses four routing tiers.

Cultural and sentiment classification — the work that requires understanding Nigerian language patterns, Pidgin expressions, and local cultural context — routes to Claude Haiku. It is the fastest and most cost-efficient model, and for high-volume classification of thousands of daily mentions, that matters.

Structural generation — monthly reports, competitive briefings, funnel diagnostics, the Ask AI chat, and most AI analysis features — routes to Claude Sonnet. It balances quality with speed and is the workhorse of the product.

Board-grade business cases route to Claude Opus, the most capable model in the family. This is the one context where the output will be read by investors or executives making budget decisions, and the quality bar is correspondingly higher.

The fourth tier is the chat interface, which also uses Sonnet. Conversations are stored and can be resumed across sessions. The system never displays which model answered a question.

The model names never appear in the UI. From the user's perspective, they are talking to BrandPulse AI.

---

## Who It Is Built For

BrandPulse ships with seven industry vertical presets, each reflecting a different model of what brand health means in that category.

**FMCG** (consumer packaged goods) is the default. Awareness and sentiment carry equal weight at 20% each because FMCG brands compete on reach and emotional connection. Cultural resonance is a full 15% because local relevance drives shelf sales.

**Fintech** shifts weight toward trust. Sentiment rises to 25%, Perception to 20%, SOV to 15%. Cultural resonance drops to 5% because Nigerian fintech brands live or die on whether people trust them with their money. App store ratings and regulatory standing are surfaced as a dedicated Trust Pillar card.

**Venue** (restaurants, hotels, entertainment venues) gives Perception the highest weight at 25% and Salience at 20%. When you are choosing where to eat, what other people said in reviews matters more than share of voice. Google Maps ratings and review velocity feed directly into the BHI.

**B2B SaaS** zeroes out Cultural Resonance entirely. G2-style review ratings (Perception at 25%) and LinkedIn share of voice (SOV at 20%) dominate. The developer health panel surfaces GitHub and npm signals.

**Marketplace** balances awareness and perception, with a moderate cultural resonance weighting because marketplaces live or die on trust and local relevance in a fragmented market.

**Beverage/Alcohol** is similar to FMCG but raises Awareness to 22% because category spend on OOH and events is higher. Sentiment drops slightly to 18%.

**B2B Distribution** focuses on trade partner relationships. Perception and SOV both weight at 20%, reflecting that distributor trust and industry visibility are the key assets. Cultural resonance drops to 5%, EMV drops to zero.

---

## The Technical Foundation

BrandPulse runs on Next.js 16 with the App Router, TypeScript throughout, and Supabase as the database and authentication layer. Postgres Row-Level Security enforces multi-tenancy — every query is automatically scoped to the user's workspace, so it is structurally impossible for one customer to see another's data. Background jobs run on Inngest, which provides durable execution, retries, and a visual job history. AI calls go through a shared client in `lib/ai/client.ts` that handles the four-tier routing. The UI is built on shadcn/ui with Tailwind, and charts use Recharts. All API keys and credentials are stored server-side only, encrypted at rest, and never passed to the browser.

---

## What Makes It Different

Five things make BrandPulse genuinely different from generic analytics tools.

**It was designed for Nigeria, not adapted for it.** The market benchmarks, the cultural profile system, the Pidgin-aware sentiment model, the NGN-denominated EMV formula, the Lagos-time cron schedules — these are not cosmetic localisations. They reflect how the market actually works.

**It connects offline and online in one score.** A billboard in Surulere and a Meta campaign running nationally both feed the same Brand Health Index. Most tools cannot do this. BrandPulse treats OOH, events, and field reports as first-class data sources.

**The AI reads your data, not the internet.** When a marketer asks "why did our sentiment drop this week?", the answer comes from the brand's actual mentions, actual SOV snapshot, and actual campaign history — not a generic response about brand crises. The system builds a live data snapshot for every question.

**Brand health is a number, not a report.** Marketing teams in Nigeria have historically received brand health data six weeks after the period it covers, in a 40-page PDF they cannot act on. BrandPulse produces a score that updates every morning. A team can see on a Tuesday that something happened on Monday.

**It tracks how AI assistants see the brand.** As consumers start asking ChatGPT, Gemini, and Perplexity for product recommendations, what those models say about a brand becomes a new kind of share of voice. BrandPulse is one of the first platforms to measure this directly, generating category-relevant questions weekly and recording whether the brand is mentioned, where, and in what tone.
