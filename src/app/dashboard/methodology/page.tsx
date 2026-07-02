import { BookOpen, BarChart2, TrendingUp, Target, Users, Palette, Radio, Tv, Newspaper, MapPin, Zap, Award, Globe, Filter, Trophy } from 'lucide-react'
import { TourTrigger } from '@/components/tours/tour-trigger'

export const metadata = { title: 'Methodology — BrandPulse AI' }

const sections = [
  {
    id: 'bhi',
    icon: BarChart2,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    title: 'Brand Health Index (BHI)',
    subtitle: 'A composite score that tracks the overall health of your brand across three live data signals.',
    body: [
      {
        heading: 'How it is calculated',
        text: 'BHI is a weighted average of three components: Social Sentiment (40%), Share of Voice (30%), and Survey Score (30%). Each component is scored 0–100. Where a data source is not yet connected, its weight is redistributed proportionally across the remaining components so the score always reflects real data — never a default zero.',
      },
      {
        heading: 'What each zone means',
        text: 'At Risk (below 40) — significant brand challenges require urgent attention. Building (40–64) — positive momentum but measurable gaps remain. Healthy (65–79) — strong brand fundamentals with room for optimisation. Leading (80+) — above-market brand equity position.',
      },
      {
        heading: 'Industry grounding',
        text: 'The 40/30/30 weight split reflects the Millward Brown BrandZ framework, adapted for African emerging markets where earned media (social sentiment) carries higher purchase-decision weight than in established markets. Survey anchoring at 30% aligns with the GfK Brand Health Tracking methodology used by FMCG, telco, and financial brands across West Africa.',
      },
    ],
  },
  {
    id: 'brand-equity',
    icon: Award,
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    title: 'Brand Equity Tracker',
    subtitle: 'A seven-component view that separates brand equity into its constituent parts — awareness, salience, sentiment, perception, cultural fit, voice, and media value.',
    body: [
      {
        heading: 'The seven components',
        text: 'Awareness (20%) — your Share of Voice percentage relative to tracked competitors. Salience (15%) — aided awareness rate from survey responses (the share of respondents who recognise the brand when prompted). Sentiment (20%) — average social sentiment score over the last 14 days. Perception (15%) — average rating across eight brand perception dimensions from Brand Perception Audit surveys. Cultural Resonance (15%) — sourced from Pre-Post and Cultural Intelligence data; reflects how well brand content lands within Nigerian cultural context. Blended SOV (10%) — corroborating social SOV reading. Earned Media Value (5%) — estimated monetary value of organic mentions, normalised to 0–100.',
      },
      {
        heading: 'Excess Share of Voice (ESOV)',
        text: 'ESOV = Share of Voice % minus your Market Share %. A positive ESOV indicates you are spending above your weight class, which the Les Binet and Peter Field "The Long and the Short of It" research consistently links to future market share growth. Posture bands: Growth Mode (+5% or higher), Mild Growth (0–5%), Parity (0%), Decline Risk (0 to −5%), Critical Decline (below −5%).',
      },
      {
        heading: 'Budget-to-ESOV Simulator',
        text: 'Enter a target ESOV and BrandPulse estimates the additional media investment required. The model uses your current SOV-to-spend ratio as a baseline multiplier. Output is directional, not a guarantee — it is designed to anchor budget conversations with finance stakeholders.',
      },
    ],
  },
  {
    id: 'sentiment',
    icon: TrendingUp,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    title: 'Social Sentiment Intelligence',
    subtitle: 'Real-time analysis of how audiences talk about your brand across connected social platforms.',
    body: [
      {
        heading: 'Blended sentiment score',
        text: 'When data arrives from multiple platforms (X, Instagram), scores are blended using a volume-weighted formula: Σ(platform score × platform mention volume) / total volume. This means a platform with 10× the mention volume has 10× the influence on the blended score — avoiding misleading averages where a low-volume platform drags down or inflates the reading.',
      },
      {
        heading: 'Sentiment classification',
        text: 'Each social mention is classified as positive, neutral, or negative using our fastest AI tier, specifically calibrated for Nigerian Pidgin English, Yoruba-inflected expressions, Igbo code-switching, and Hausa digital vernacular. Standard English-only models misclassify approximately 30–40% of West African social content, which is why we built a dedicated cultural classification layer.',
      },
      {
        heading: 'Emotion detection',
        text: 'Beyond positive/negative, BrandPulse maps mentions to the Plutchik eight-emotion model: Joy, Trust, Anticipation, Surprise, Fear, Sadness, Disgust, and Anger. This lets brand managers distinguish between a high-sentiment score driven by genuine affection versus one driven by hype, and catch subtle shifts like rising fear or disgust before they become visible in overall scores.',
      },
      {
        heading: 'Automated alerts',
        text: 'Three alert types run on every data refresh. Crash alerts fire when the daily sentiment delta drops by 10 or more points (Warning) or 20 or more points (Critical). Spike Watch fires when sentiment rises 20+ points in a day — unusual positive surges can signal a viral moment worth amplifying. Sustained Negativity fires when more than 60% of mentions are negative for three or more consecutive days.',
      },
    ],
  },
  {
    id: 'sov',
    icon: Target,
    color: 'text-sky-600',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    title: 'Share of Voice (SOV)',
    subtitle: 'The proportion of total category conversation that your brand owns across social media.',
    body: [
      {
        heading: 'Calculation',
        text: 'Social SOV = (Brand Mentions ÷ Brand Mentions + All Tracked Competitor Mentions) × 100. Mentions are sourced from X (Twitter) via the native mentions API and Instagram via hashtag and tag tracking. Competitor mentions are tracked using the handle and keyword list you configure under Settings — Competitors.',
      },
      {
        heading: 'Why SOV matters',
        text: 'SOV is the single best predictor of future market share movement available without sales data. In markets where purchase data is hard to capture (informal retail, cash transactions), SOV acts as the leading indicator that brand investment is working. We track weekly SOV snapshots so you can see trend direction, not just point-in-time readings.',
      },
    ],
  },
  {
    id: 'funnel',
    icon: Filter,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    title: 'Brand Funnel',
    subtitle: 'Six funnel stages — each scored 0–100 from live data — showing where audiences are converting and where they are dropping off.',
    body: [
      {
        heading: 'Stage definitions and scoring',
        text: 'Awareness: Your Social SOV percentage, directly converted to a 0–100 score. Consideration: Average post engagement rate from the last 30 days, scaled so that a 10% engagement rate equals 100. Preference: Average social sentiment score over the last 14 days, already on a 0–100 scale. Action: A composite of event lead-capture rate (60% of this stage score, where a 100% capture rate earns 60 points) and OOH vanity link visits (40% of this stage score, where 8,000 monthly visits earns the full 40 points). Loyalty: Your Net Promoter Score rescaled from the −100 to +100 NPS range to a 0–100 scale using the formula (NPS / 2) + 50. Advocacy: Organic share rate from social posts multiplied by 5, capped at 100.',
      },
      {
        heading: 'Drop-off interpretation',
        text: 'Drop-off percentage between adjacent stages is colour-coded: green (15% or less — healthy), amber (16–30% — worth monitoring), red (above 30% — a meaningful bottleneck). A large Awareness-to-Consideration drop usually indicates content quality or targeting issues. A large Preference-to-Action drop usually indicates a distribution or conversion barrier. A large Action-to-Loyalty drop usually indicates a product or onboarding issue.',
      },
    ],
  },
  {
    id: 'nps',
    icon: ClipboardListIcon,
    color: 'text-teal-600',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    title: 'Net Promoter Score (NPS)',
    subtitle: 'The globally standard measure of customer loyalty and advocacy likelihood.',
    body: [
      {
        heading: 'Calculation',
        text: 'Respondents rate their likelihood to recommend the brand on a 0–10 scale. Promoters score 9–10. Passives score 7–8. Detractors score 0–6. NPS = ((Promoters − Detractors) ÷ Total Respondents) × 100. Range is −100 (all detractors) to +100 (all promoters). A minimum of three NPS responses is required before BrandPulse will display a score, to avoid misleading single-response readings.',
      },
      {
        heading: 'Nigerian market benchmarks',
        text: 'NPS benchmarks vary significantly by category. Financial services typically score 20–40. Telcos typically score 5–25. FMCG typically scores 30–55. Fintech and digital-first brands typically score 40–65. BrandPulse does not apply a universal benchmark because category context matters more than absolute number.',
      },
    ],
  },
  {
    id: 'prepost',
    icon: Zap,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    title: 'Pre-Post Content Intelligence',
    subtitle: 'AI-powered scoring of brand content before publication and comparison against post-campaign sentiment shifts.',
    body: [
      {
        heading: 'Pre-publication scoring',
        text: 'Content is scored across five dimensions: Cultural Resonance (does it connect with Nigerian cultural context, idioms, and seasonal moments?), Brand Safety (does it carry reputational risk?), Clarity (is the message clear to the intended audience?), Engagement Potential (is it likely to drive interaction?), and CTA Effectiveness (is the call to action prominent and compelling?). Each dimension is scored 0–100 by our culturally-calibrated AI.',
      },
      {
        heading: 'Cultural calibration',
        text: 'Most AI content scoring tools are trained on Western English-language datasets and systematically misread Nigerian cultural signals. BrandPulse uses a cultural interpretation layer that accounts for Pidgin expressions, Nigerian slang lifecycles, festival and religious calendar sensitivity, and regional nuance (Lagos vs Abuja vs Port Harcourt audience expectations).',
      },
      {
        heading: 'Image and video analysis',
        text: 'Upload an image or video alongside text. For videos, BrandPulse extracts the first frame automatically (no upload processing required) and uses computer vision to assess the hook, visual quality, sound-off viewability, and CTA visibility — the four most important video performance indicators for Nigerian social platforms where data costs mean many users watch without sound.',
      },
    ],
  },
  {
    id: 'cultural',
    icon: Globe,
    color: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    title: 'Cultural Resonance Score (CRS)',
    subtitle: 'A running measure of how consistently your brand content connects with Nigerian cultural context.',
    body: [
      {
        heading: 'Calculation',
        text: 'CRS is the rolling average of the cultural_resonance dimension from all Pre-Post Intelligence analyses. A minimum of three analyses is needed for the score to be meaningful. Drift is measured by comparing the 7-day moving average against the prior 23-day average — a meaningful divergence triggers a drift badge.',
      },
      {
        heading: 'Emotion resonance',
        text: 'The emotion resonance bar measures the proportion of content analyses where Joy, Trust, or Anticipation was the dominant emotional tone — the three emotions most strongly associated with purchase intent in Nigerian consumer research. A high emotion resonance ratio alongside a high CRS indicates content that is both culturally appropriate and emotionally activating.',
      },
      {
        heading: 'Cultural Calendar',
        text: 'Nigerian and West African cultural moments (Ramadan, Christmas, Sallah, Valentine\'s Day Nigeria, Independence Day, Children\'s Day, etc.) are surfaced 45 days in advance. Brands that produce culturally relevant content around these moments consistently outperform category averages on both engagement rate and brand recall.',
      },
    ],
  },
  {
    id: 'influencer',
    icon: Users,
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    title: 'Influencer Intelligence',
    subtitle: 'Two proprietary scores that assess creator fit for your brand from a cultural and reputational lens.',
    body: [
      {
        heading: 'Cultural IQ',
        text: 'Scored 0–100. Measures how well the creator resonates with Nigerian audiences within the specific industry context of your brand. High Cultural IQ (70+) means the creator\'s content style, language, and audience demographics are a strong cultural match. Factors include language and tone naturalness, local cultural reference depth, audience location and demographic composition, and platform-specific engagement quality.',
      },
      {
        heading: 'Risk Score',
        text: 'Scored 0–100, where 0 is very safe and 100 is very high risk. Assesses brand safety exposure based on the creator\'s content history, controversy footprint, and audience alignment. Risk is evaluated within the context of your specific brand category — a risk factor relevant to a food brand may be irrelevant to a fintech.',
      },
      {
        heading: 'Brand Fit',
        text: 'A composite assessment (scored 0–100) that evaluates audience overlap, value alignment between creator content and brand positioning, and recommendation confidence. Brand Fit returns one of three verdicts: Strong Fit, Potential Fit, or Poor Fit.',
      },
    ],
  },
  {
    id: 'creative',
    icon: Palette,
    color: 'text-pink-600',
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    title: 'Creative Analysis',
    subtitle: 'AI-powered comparison, identity consistency checking, and video performance scoring for brand creatives.',
    body: [
      {
        heading: 'A/B Creative Comparison',
        text: 'Two creatives are scored across five dimensions: Engagement Potential, Cultural Resonance, Tone Appropriateness, Clarity, and Risk. When images or video frames are uploaded, the analysis uses computer vision to assess the visual alongside the text — not just the copy. The model explicitly evaluates for the Nigerian and West African market context.',
      },
      {
        heading: 'Brand Identity Consistency',
        text: 'Analyses up to three recent brand posts simultaneously and returns a consistency score (0–100), identified brand strengths, drift warnings (where recent content deviates from established brand voice), and specific adjustments to close the gap. This is designed to catch brand dilution early — a common issue when multiple agencies or internal teams are producing content.',
      },
      {
        heading: 'Video Creative Scoring',
        text: 'Four dimensions for video: Hook Score (does the first frame stop the scroll?), Visual Score (quality, composition, branding clarity), Sound-Off Score (does it communicate with the sound muted, using text overlays and visual storytelling?), and CTA Visibility (how clear and actionable is the call to action?). Sound-off scoring matters because a significant portion of Nigerian social media video is consumed in low-data or public environments where sound is not played.',
      },
    ],
  },
  {
    id: 'ooh',
    icon: MapPin,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    title: 'OOH Intelligence',
    subtitle: 'Out-of-home attribution and performance tracking using branded vanity links and search uplift correlation.',
    body: [
      {
        heading: 'Primary attribution: vanity links',
        text: 'Every OOH placement can be assigned a branded vanity URL (e.g. brand.com/go/ikeja-junction). When an audience member scans or types that URL, BrandPulse logs the visit, timestamps it, and links it to the specific billboard. This is the primary attribution method because it produces deterministic, one-to-one conversion data with no modelling assumptions.',
      },
      {
        heading: 'Secondary corroboration: search uplift',
        text: 'BrandPulse computes a Pearson correlation coefficient between weekly billboard visit counts and weekly Google branded search volume (via Google Trends) for the same time period. A correlation above 0.6 is interpreted as meaningful evidence that OOH exposure is driving branded search behaviour — a standard corroboration methodology used by GroupM and Kinetic Worldwide.',
      },
      {
        heading: 'GeoLift studies',
        text: 'For brands running OOH in multiple cities, BrandPulse can run a GeoLift study: a treatment city (where OOH is active) is compared against a control city (no OOH) and Pearson correlation is computed between the two cities\' sentiment or sales-proxy signals. This isolates the incremental effect of the OOH spend from organic brand momentum.',
      },
    ],
  },
  {
    id: 'radio',
    icon: Radio,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    title: 'Radio Intelligence',
    subtitle: 'Daypart efficiency analysis and agency post-buy reconciliation for Nigerian radio buys.',
    body: [
      {
        heading: 'How data enters BrandPulse',
        text: 'Radio data is logged from your media agency\'s buy plan and post-buy report — either via CSV upload or manual entry. BrandPulse does not monitor live broadcasts. Spots Planned comes from your approved buy; Spots Aired comes from the delivery confirmation your agency provides after each flight. Dayparts follow the Nigerian radio industry standard: Morning Drive (06:00–10:00), Daytime (10:00–15:00), Afternoon Drive (15:00–19:00), Evening (19:00–22:00), and Late Night (22:00–06:00).',
      },
      {
        heading: 'Daypart Efficiency Ranking',
        text: 'BrandPulse holds a static listenership database for Nigerian stations (Beat FM, Cool FM, Wazobia FM, Naija FM, Smooth FM, Rhythm FM, and others). The AI combines your logged spend and spot count with the station\'s reach figures to compute cost-per-impression per daypart. Dayparts are then ranked by efficiency, giving you a clear reallocation guide for your next buy.',
      },
    ],
  },
  {
    id: 'tv',
    icon: Tv,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    title: 'TV Intelligence',
    subtitle: 'GRP reconciliation and prime time vs fringe efficiency analysis for logged TV buys.',
    body: [
      {
        heading: 'How data enters BrandPulse',
        text: 'TV data is logged from your media agency\'s buy plan and post-buy delivery report — either via CSV upload or manual entry. BrandPulse does not monitor live broadcasts or detect spots on air. GRPs Planned and Spots Planned come from your approved buy; GRPs Delivered and Spots Aired come from the post-buy confirmation your agency provides after each flight.',
      },
      {
        heading: 'Core metrics',
        text: 'Gross Rating Points (GRP) — total audience delivery, calculated as Reach % × Average Frequency. Cost Per Rating Point (CPRP) — spend required to deliver one GRP; lower is better. Cost Per Thousand (CPT) — spend required to reach 1,000 members of the target audience. These are the industry-standard metrics used by all major Nigerian agencies.',
      },
      {
        heading: 'AI analysis',
        text: 'The AI layer compares your logged planned vs delivered GRPs to surface underdelivery, ranks programmes by cost-efficiency, and analyses prime time versus fringe allocation. BrandPulse holds a channel database covering NTA, AIT, Channels TV, TVC, Africa Magic, SuperSport, and major regional stations — these are reference records for matching and efficiency benchmarking, not live monitoring feeds.',
      },
    ],
  },
  {
    id: 'print',
    icon: Newspaper,
    color: 'text-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    title: 'Print Intelligence',
    subtitle: 'Publication reach, cost efficiency, and QR-primary digital attribution for newspaper and magazine placements.',
    body: [
      {
        heading: 'Readership calculation',
        text: 'Readership = Circulation × Pass-Along Multiplier. Each publication in the BrandPulse database carries a validated pass-along multiplier — the average number of additional readers per copy sold. For mass dailies like The Punch and Vanguard, this is typically 3–4×. For business titles like BusinessDay, it is closer to 2×. Multipliers are sourced from APCON-registered readership studies.',
      },
      {
        heading: 'QR attribution (primary)',
        text: 'BrandPulse auto-generates a unique QR code and vanity URL for each print placement. When readers scan the QR code, the visit is logged and attributed directly to that edition and publication. This makes print attribution deterministic rather than modelled. The Nigerian average QR scan rate for print is approximately 0.3% of estimated readership — any placement exceeding this benchmark is a top performer.',
      },
      {
        heading: 'Cost Per Thousand (CPT)',
        text: 'CPT = (Net Cost ÷ Estimated Readership) × 1,000. Publications and positions are ranked by CPT so media planners can see immediately which placements delivered the most efficient reach.',
      },
    ],
  },
  {
    id: 'competitive',
    icon: Trophy,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    title: 'Competitive Intelligence',
    subtitle: 'Weekly AI briefings, ESOV league table, and a structured sightings feed for tracking competitor activity.',
    body: [
      {
        heading: 'Weekly AI briefing',
        text: 'Every Monday at 08:00 Lagos time, BrandPulse generates a competitive briefing for each brand. The briefing synthesises the past week\'s competitor sightings, SOV movements, sentiment shifts, and campaign signals into a structured narrative with strategic implications and recommended responses. The briefing is delivered in the app and via email.',
      },
      {
        heading: 'ESOV League',
        text: 'Every tracked competitor is assigned a share of voice percentage. The ESOV League table ranks all players by SOV% minus estimated market share%, showing which brands are outspending their weight class and which are underinvesting. This is a standard media planning framework used by Mediacom, GroupM, and PHD Nigeria.',
      },
      {
        heading: 'Sightings feed',
        text: 'Campaign sightings (billboards, events, digital ads, TV spots, radio, activations, PR) are logged manually by the team and fed into the AI briefing engine. The more sightings logged, the richer the competitive intelligence output.',
      },
    ],
  },
]

function ClipboardListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </svg>
  )
}

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl space-y-8 pb-16">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Our Methodology</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              How BrandPulse calculates every score, metric, and index — grounded in established measurement frameworks and adapted for the Nigerian and West African market.
            </p>
          </div>
        </div>
        <TourTrigger module="methodology" autoStart />
      </div>

      <div data-tour="methodology-main" />

      {/* Intro callout */}
      <div className="border rounded-xl p-5 bg-muted/30 space-y-2">
        <p className="text-sm font-medium">Built for African brand realities</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Most brand intelligence tools were built for US and European markets and retrofitted for Africa. BrandPulse is built the other way around. Every formula, every benchmark, every AI calibration starts with the Nigerian market and expands outward. Where we apply international frameworks — BrandZ, NPS, Les Binet ESOV theory, Pearson correlation for media attribution — we adapt the parameters, thresholds, and language models for local context.
        </p>
      </div>

      {/* Sections */}
      {sections.map(section => {
        const Icon = section.icon
        return (
          <div key={section.id} id={section.id} className="border rounded-xl overflow-hidden">
            <div className={`${section.bg} border-b px-5 py-4 flex items-start gap-3`}>
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${section.color}`} />
              <div>
                <h2 className="text-base font-semibold">{section.title}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{section.subtitle}</p>
              </div>
            </div>
            <div className="divide-y">
              {section.body.map((block, i) => (
                <div key={i} className="px-5 py-4 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{block.heading}</p>
                  <p className="text-sm leading-relaxed text-foreground/90">{block.text}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Marketing Frameworks */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Marketing Frameworks Behind BrandPulse</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Every metric in BrandPulse is grounded in established academic and practitioner frameworks. Here is how we apply them — in plain terms.
          </p>
        </div>

        {[
          {
            name: "Aaker's Brand Equity Model",
            where: 'Brand Equity Tracker, BHI, Voice Builder',
            body: "David Aaker defines brand equity as the premium a brand adds to a product beyond its functional value. He identifies five sources: Brand Loyalty, Brand Awareness, Perceived Quality, Brand Associations, and Other Proprietary Assets. BrandPulse maps these directly: Loyalty → NPS and repeat survey responses; Awareness → Share of Voice; Perceived Quality → Brand Perception Audit ratings; Associations → Cultural Resonance and Voice Builder alignment; Proprietary Assets → EMV from earned media. When your BHI is high, you are building Aaker equity — not just vanity metrics.",
          },
          {
            name: "Kapferer Brand Identity Prism",
            where: 'Brand Voice Builder',
            body: "Jean-Noël Kapferer's prism has six facets: Physique (visual identity), Personality (tone of voice), Culture (values and origin), Relationship (how the brand interacts with consumers), Reflection (the customer archetype the brand projects), and Self-image (how customers see themselves when they use the brand). BrandPulse's Brand Voice Builder translates this into the five fields you fill in: tone adjectives map to Personality, dos and don'ts map to Culture and Relationship, and signature phrases reflect your Physique and Self-image. Every piece of content reviewed by BrandPulse AI is scored against this prism.",
          },
          {
            name: 'ESOV — Binet & Field Model',
            where: 'Business Case, Share of Voice',
            body: "Les Binet and Peter Field, in 'The Long and Short of It' (2013, IPA Databank, 1,400 campaigns), established that Excess Share of Voice — your SOV minus your market share — is the single strongest predictor of long-run market share growth. A positive ESOV of +5 to +10 points, sustained over 12–18 months, corresponds to roughly +1 point of market share gain per year in FMCG. BrandPulse calculates your ESOV in real time and flags it prominently in the Business Case and SOV dashboards. The benchmark holds in Nigerian FMCG and QSR categories — the mechanism (mental salience via repeated exposure) is universal.",
          },
          {
            name: "7Ps of Marketing Mix",
            where: 'Campaigns, Business Case',
            body: "The original 4Ps (Product, Price, Place, Promotion) were extended to 7Ps by Booms and Bitner for service businesses by adding People, Process, and Physical Evidence. BrandPulse touches all seven through its campaign architecture: Promotion maps to social and paid campaigns; Place maps to OOH, radio, and digital channel tracking; People maps to Influencer and Ambassador tracking; Process maps to Survey and Funnel diagnostics. When the Business Case AI identifies gaps, it frames them in 7Ps language so your board presentation has a recognised strategic structure.",
          },
          {
            name: "Porter's Five Forces",
            where: 'Competitive Intelligence',
            body: "Michael Porter's Five Forces — Competitive Rivalry, Threat of New Entrants, Supplier Power, Buyer Power, and Threat of Substitutes — is the standard framework for understanding industry attractiveness and competitive position. BrandPulse uses it as the lens for Competitive Intelligence: Rival SOV and sighting frequency signal Competitive Rivalry intensity; new competitor appearances in your category signal New Entrant threats. When the Competitive AI briefing warns you about an escalating competitor, it is Porter's Rivalry lens applied to your real-time SOV and sighting data.",
          },
          {
            name: 'BCG Matrix — Campaign Portfolio',
            where: 'Business Case — Channel Investment',
            body: "The Boston Consulting Group Matrix classifies business units (here: channels) by two axes — relative market share and growth rate. Applied to marketing channels: Stars (high share of your spend, high engagement returns) are digital and social — invest here. Cash Cows (proven ROI, lower growth ceiling) are TV and radio for brand awareness — maintain. Question Marks (unclear returns, potential upside) are influencer and OOH — test and scale selectively. Dogs (low share, low return) are untargeted print — cut unless brand-specific evidence proves otherwise. The Business Case page uses this classification to surface your highest-leverage channel.",
          },
          {
            name: 'Ansoff Growth Matrix',
            where: 'Business Case, AI Strategic Recommendations',
            body: "Igor Ansoff's matrix maps growth strategy on two axes: Markets (existing vs new) and Products (existing vs new). Market Penetration (existing product, existing market) — grow BHI and SOV in your current category; this is where most of BrandPulse's diagnostics point first. Market Development (existing product, new market) — expand to a new city or demographic; Cultural Intelligence and Survey segmentation support this. Product Development (new product, existing market) — launch a new SKU; Pre-Post Intelligence can measure how well it lands. Diversification (new product, new market) — highest risk, highest reward. When BrandPulse AI identifies opportunities, it references which quadrant the opportunity sits in.",
          },
          {
            name: 'SWOT Analysis',
            where: 'AI Insights, Business Case',
            body: "SWOT (Strengths, Weaknesses, Opportunities, Threats) is the most widely-used strategic planning tool. BrandPulse generates SWOT inputs automatically: Strengths — high BHI components, positive sentiment drivers, high NPS; Weaknesses — low-scoring BHI components, negative sentiment themes, low survey perception scores; Opportunities — positive ESOV position, underserved audience segments (survey data), cultural moments your competitors are missing; Threats — negative ESOV, rising competitor SOV, competitor sightings in your core category. The Business Case AI synthesises these into the Risks and Asks sections of the board report.",
          },
          {
            name: 'Ehrenberg-Bass Mental Availability',
            where: 'Share of Voice, Sentiment, Creative Analysis',
            body: "Byron Sharp's 'How Brands Grow' (2010) established that brand growth comes primarily from reaching all buyers in the category with distinctive brand assets — not from loyalty programs or narrow targeting. Mental Availability (being thought of in a buying situation) is driven by the number of category entry points you own. BrandPulse tracks this through SOV (how much of the category conversation you own), Sentiment (are those mentions positive enough to build memory structures), Creative Distinctiveness (via Creative Analysis scoring), and Cultural Resonance (are your distinctive assets landing in the right cultural context). A rising BHI at consistent SOV = growing mental availability.",
          },
          {
            name: 'Perceptual Mapping',
            where: 'Competitive Intelligence, Brand Perception Audit',
            body: "Perceptual maps plot brands in a two-dimensional space defined by attributes that consumers use to differentiate them — e.g., Premium vs Affordable on one axis, Traditional vs Modern on the other. BrandPulse's Brand Perception Audit survey captures eight dimensions that can be plotted as a radar chart against competitor perceptions. The Competitive Intelligence sightings and SOV data anchor your position in the category conversation relative to rivals. Over time, you can see whether your brand is moving toward or away from the position you want to own.",
          },
        ].map(fw => (
          <div key={fw.name} className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/20">
              <p className="text-[13.5px] font-semibold">{fw.name}</p>
              <p className="text-[11px] text-primary font-medium mt-0.5">Used in: {fw.where}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-relaxed text-foreground/90">{fw.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="border rounded-xl p-5 space-y-2 bg-muted/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">A note on AI usage</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          BrandPulse uses three tiers of AI depending on task complexity. Cultural tasks — sentiment classification, Pre-Post scoring, cultural resonance — use our fastest model, calibrated specifically for Nigerian linguistic patterns. Structural analysis tasks — creative comparison, influencer scoring, funnel diagnosis, competitive briefings — use our mid-tier model. Board-grade outputs — business cases, strategic recommendations requiring deep synthesis — use our most capable model.
        </p>
      </div>
    </div>
  )
}
