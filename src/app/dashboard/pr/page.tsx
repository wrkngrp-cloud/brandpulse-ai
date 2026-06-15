import { FileSearch, Globe, TrendingUp, BarChart2, Zap } from 'lucide-react'
import { PrMentionsChart } from './pr-mentions-chart'

const PR_MENTIONS = [
  {
    publication: 'TechCabal',
    headline: 'Jara Foods disrupts Nigeria\'s food delivery market with AI-powered meal planning',
    sentiment: 'Positive' as const,
    reach: 45000,
    domainAuthority: 78,
    date: '12 Jun 2025',
  },
  {
    publication: 'BusinessDay',
    headline: 'Q2 results: Jara Foods revenue grows 34% YoY amid tough consumer market',
    sentiment: 'Very Positive' as const,
    reach: 120000,
    domainAuthority: 85,
    date: '9 Jun 2025',
  },
  {
    publication: 'Nairametrics',
    headline: 'Analysis: Can Jara Foods compete with established players in Nigeria\'s food sector?',
    sentiment: 'Neutral' as const,
    reach: 67000,
    domainAuthority: 72,
    date: '5 Jun 2025',
  },
  {
    publication: 'Pulse Nigeria',
    headline: 'Jara Foods partners with Lagos State for school feeding program rollout',
    sentiment: 'Positive' as const,
    reach: 38000,
    domainAuthority: 65,
    date: '2 Jun 2025',
  },
  {
    publication: 'TechPoint Africa',
    headline: 'Startup spotlight: Jara Foods\' tech-first approach to food distribution in West Africa',
    sentiment: 'Positive' as const,
    reach: 22000,
    domainAuthority: 70,
    date: '28 May 2025',
  },
]

type Sentiment = 'Very Positive' | 'Positive' | 'Neutral' | 'Negative'

const SENTIMENT_STYLES: Record<Sentiment, string> = {
  'Very Positive': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Positive':      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Neutral':       'bg-muted text-muted-foreground',
  'Negative':      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

function formatReach(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return String(n)
}

export default function PRTrackingPage() {
  const totalReach = PR_MENTIONS.reduce((s, m) => s + m.reach, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">PR & Earned Media Tracking</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monitor press coverage and understand how earned media shapes your brand health.
        </p>
      </div>

      {/* EMV summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span className="text-xs font-medium">PR Reach (month)</span>
          </div>
          <p className="text-2xl font-bold">292K</p>
        </div>
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Estimated EMV</span>
          </div>
          <p className="text-2xl font-bold">₦4.8M</p>
        </div>
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileSearch className="h-4 w-4" />
            <span className="text-xs font-medium">Articles Published</span>
          </div>
          <p className="text-2xl font-bold">12</p>
        </div>
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart2 className="h-4 w-4" />
            <span className="text-xs font-medium">Avg Sentiment</span>
          </div>
          <p className="text-2xl font-bold">72<span className="text-sm font-normal text-muted-foreground">/100</span></p>
        </div>
      </div>

      {/* PR Mentions feed */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Recent Press Mentions</h2>
        <div className="space-y-2">
          {PR_MENTIONS.map((mention, i) => (
            <div key={i} className="border rounded-xl p-4 bg-card space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{mention.publication}</span>
                    <span className="text-xs text-muted-foreground">{mention.date}</span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-snug line-clamp-2">{mention.headline}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${SENTIMENT_STYLES[mention.sentiment]}`}>
                  {mention.sentiment}
                </span>
              </div>
              <div className="flex items-center gap-4 pt-1 border-t text-xs text-muted-foreground flex-wrap">
                <span>Reach: <span className="font-medium text-foreground">{formatReach(mention.reach)} readers</span></span>
                <span>Domain authority: <span className="font-medium text-foreground">{mention.domainAuthority}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly trend chart */}
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <div>
          <p className="text-sm font-semibold">Monthly PR Mentions</p>
          <p className="text-xs text-muted-foreground">Total press articles tracked over 6 months</p>
        </div>
        <PrMentionsChart />
      </div>

      {/* PR influence explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* PR → SOV */}
        <div className="border rounded-xl p-5 bg-card space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">PR and Share of Voice</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Press mentions contribute to your Share of Voice through earned backlinks and publication authority. A single high-DA publication (80+) mention can lift your digital SOV by 0.5-2% within 30 days. BrandPulse tracks PR coverage and attributes SOV changes to earned media.
          </p>
          <div className="pt-1 border-t">
            <p className="text-xs text-muted-foreground">
              Current highest-DA mention: <span className="font-semibold text-foreground">BusinessDay (DA 85)</span>
            </p>
          </div>
        </div>

        {/* PR → Brand Health */}
        <div className="border rounded-xl p-5 bg-card space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">PR and Brand Health Index</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Positive PR creates a halo effect on brand sentiment. Our model applies a 7-day sentiment boost (weighted by publication authority) to your Brand Health Index when significant coverage occurs. This explains why BHI can move without social media activity.
          </p>
          <div className="pt-1 border-t">
            <p className="text-xs text-muted-foreground">
              Estimated sentiment halo from this month's coverage: <span className="font-semibold text-foreground">+3.2 BHI points</span>
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-2">
        Total tracked reach this month: {formatReach(totalReach)} readers across {PR_MENTIONS.length} publications shown
      </p>
    </div>
  )
}
