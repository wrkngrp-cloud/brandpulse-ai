import { createClient }         from '@/lib/supabase/server'
import { redirect }             from 'next/navigation'
import { Globe, TrendingUp, FileSearch, BarChart2, ExternalLink, Clock, Rss } from 'lucide-react'
import { getActiveBrand }       from '@/lib/active-brand'
import { PrMentionsChart }      from './pr-mentions-chart'
import { DateRangeFilter }      from '@/components/dashboard/date-range-filter'
import { TriggerPrCrawlButton } from './trigger-pr-crawl-button'

interface PressMention {
  id:              string
  headline:        string
  publication:     string
  url:             string | null
  published_at:    string
  sentiment_score: number | null
  sentiment_label: string | null
  estimated_reach: number | null
  emv:             number | null
  is_competitor:   boolean
  competitor_name: string | null
}

interface SovSnapshot {
  press_sov:     number | null
  snapshot_date: string
}

const SENTIMENT_STYLE: Record<string, string> = {
  positive: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  neutral:  'bg-muted text-muted-foreground',
  negative: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

function fmtReach(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000)      return `${Math.round(n / 1000)}K`
  return n.toLocaleString()
}

function fmtEmv(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `NGN ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000)      return `NGN ${Math.round(n / 1000)}K`
  return `NGN ${n.toLocaleString()}`
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function PRTrackingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const days   = Math.min(180, Math.max(7, Number(params.days ?? 30)))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const brand = await getActiveBrand<{ id: string; name: string }>(supabase, 'id, name')

  if (!brand) redirect('/dashboard')

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ data: mentions }, { data: sovSnaps }] = await Promise.all([
    supabase
      .from('press_mentions')
      .select('id, headline, publication, url, published_at, sentiment_score, sentiment_label, estimated_reach, emv, is_competitor, competitor_name')
      .eq('brand_id', brand.id)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(100),
    supabase
      .from('sov_snapshots')
      .select('press_sov, snapshot_date')
      .eq('brand_id', brand.id)
      .order('snapshot_date', { ascending: false })
      .limit(30),
  ])

  const brandMentions      = (mentions ?? []).filter(m => !m.is_competitor) as PressMention[]
  const competitorMentions = (mentions ?? []).filter(m => m.is_competitor)  as PressMention[]

  const hasData = brandMentions.length > 0

  // Aggregate stats
  const totalEmv   = brandMentions.reduce((s, m) => s + (m.emv ?? 0), 0)
  const totalReach = brandMentions.reduce((s, m) => s + (m.estimated_reach ?? 0), 0)
  const sentCounts = { positive: 0, neutral: 0, negative: 0 }
  for (const m of brandMentions) {
    const l = m.sentiment_label as 'positive' | 'neutral' | 'negative' | null
    if (l && l in sentCounts) sentCounts[l]++
  }
  const total     = brandMentions.length
  const latestSov = (sovSnaps ?? []).find(s => s.press_sov !== null) as SovSnapshot | undefined

  // Monthly data for chart
  const monthlyMap: Record<string, number> = {}
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  for (const m of brandMentions) {
    const d = new Date(m.published_at)
    if (d < sixMonthsAgo) continue
    const label = d.toLocaleDateString('en-NG', { month: 'short' })
    monthlyMap[label] = (monthlyMap[label] ?? 0) + 1
  }
  const monthlyData = Object.entries(monthlyMap).map(([month, mentions]) => ({ month, mentions }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">PR &amp; Earned Media Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor press coverage and understand how earned media shapes your brand health.
          </p>
        </div>
        <DateRangeFilter currentDays={days} defaultDays={30} />
      </div>

      {!hasData ? (
        /* ── Empty state ── */
        <div className="border rounded-xl p-10 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Rss className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Monitoring your press mentions</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              BrandPulse crawls Nigerian publications nightly at 7 AM Lagos time — searching for {brand.name} across The Punch, Vanguard, BusinessDay, TechCabal, Nairametrics, and 6 more outlets.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Next crawl at 7 AM Lagos time
            </div>
            <TriggerPrCrawlButton />
          </div>
        </div>
      ) : (
        <>
          {/* EMV summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border rounded-xl p-4 bg-card space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Total EMV</span>
              </div>
              <p className="text-2xl font-bold">{fmtEmv(totalEmv)}</p>
              <p className="text-xs text-muted-foreground">earned media value</p>
            </div>
            <div className="border rounded-xl p-4 bg-card space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span className="text-xs font-medium">Total Reach</span>
              </div>
              <p className="text-2xl font-bold">{fmtReach(totalReach)}</p>
              <p className="text-xs text-muted-foreground">estimated readers</p>
            </div>
            <div className="border rounded-xl p-4 bg-card space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileSearch className="h-4 w-4" />
                <span className="text-xs font-medium">Press Mentions</span>
              </div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">last {days} days</p>
            </div>
            <div className="border rounded-xl p-4 bg-card space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <BarChart2 className="h-4 w-4" />
                <span className="text-xs font-medium">Positive Rate</span>
              </div>
              <p className="text-2xl font-bold">
                {total > 0 ? Math.round((sentCounts.positive / total) * 100) : 0}
                <span className="text-sm font-normal text-muted-foreground">%</span>
              </p>
              <p className="text-xs text-muted-foreground">of mentions</p>
            </div>
          </div>

          {/* Sentiment breakdown */}
          <div className="border rounded-xl p-5 bg-card space-y-3">
            <p className="text-sm font-semibold">Sentiment breakdown</p>
            <div className="grid grid-cols-3 gap-3">
              {(['positive', 'neutral', 'negative'] as const).map(label => (
                <div
                  key={label}
                  className={`rounded-lg p-3 space-y-1 ${
                    label === 'positive' ? 'bg-green-50 dark:bg-green-900/10'
                    : label === 'negative' ? 'bg-red-50 dark:bg-red-900/10'
                    : 'bg-muted/40'
                  }`}
                >
                  <p className="text-xs text-muted-foreground capitalize">{label}</p>
                  <p className="text-xl font-bold">{sentCounts[label]}</p>
                  <p className="text-xs text-muted-foreground">
                    {total > 0 ? Math.round((sentCounts[label] / total) * 100) : 0}%
                  </p>
                </div>
              ))}
            </div>
            <div className="h-2 rounded-full overflow-hidden flex">
              {sentCounts.positive > 0 && (
                <div className="bg-green-500" style={{ width: `${(sentCounts.positive / total) * 100}%` }} />
              )}
              {sentCounts.neutral > 0 && (
                <div className="bg-muted-foreground/30" style={{ width: `${(sentCounts.neutral / total) * 100}%` }} />
              )}
              {sentCounts.negative > 0 && (
                <div className="bg-red-400" style={{ width: `${(sentCounts.negative / total) * 100}%` }} />
              )}
            </div>
          </div>

          {/* Brand mention cards */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Recent Press Mentions</h2>
            <div className="space-y-2">
              {brandMentions.map(mention => (
                <div key={mention.id} className="border rounded-xl p-4 bg-card space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold">{mention.publication}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(mention.published_at)}</span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-snug line-clamp-2">{mention.headline}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {mention.sentiment_label && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SENTIMENT_STYLE[mention.sentiment_label] ?? SENTIMENT_STYLE.neutral}`}>
                          {mention.sentiment_label.charAt(0).toUpperCase() + mention.sentiment_label.slice(1)}
                        </span>
                      )}
                      {mention.url && (
                        <a href={mention.url} target="_blank" rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-1 border-t text-xs text-muted-foreground flex-wrap">
                    <span>Reach: <span className="font-medium text-foreground">{fmtReach(mention.estimated_reach)}</span></span>
                    <span>EMV: <span className="font-medium text-foreground">{fmtEmv(mention.emv)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly chart */}
          {monthlyData.length > 0 && (
            <div className="border rounded-xl p-5 bg-card space-y-3">
              <div>
                <p className="text-sm font-semibold">Monthly PR Mentions</p>
                <p className="text-xs text-muted-foreground">Total press articles tracked over 6 months</p>
              </div>
              <PrMentionsChart data={monthlyData} />
            </div>
          )}

          {/* Competitor section */}
          {competitorMentions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">
                Competitor Mentions
                <span className="text-xs font-normal text-muted-foreground ml-2">{competitorMentions.length} articles</span>
              </h2>
              <div className="space-y-2">
                {competitorMentions.slice(0, 10).map(mention => (
                  <div key={mention.id} className="border rounded-xl p-4 bg-card opacity-80 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold">{mention.publication}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            {mention.competitor_name}
                          </span>
                          <span className="text-xs text-muted-foreground">{fmtDate(mention.published_at)}</span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-snug line-clamp-2">{mention.headline}</p>
                      </div>
                      {mention.url && (
                        <a href={mention.url} target="_blank" rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-3 pt-1 border-t text-xs text-muted-foreground">
                      <span>Reach: {fmtReach(mention.estimated_reach)}</span>
                      {mention.sentiment_label && (
                        <span className={`px-1.5 py-0.5 rounded-full font-medium ${SENTIMENT_STYLE[mention.sentiment_label] ?? SENTIMENT_STYLE.neutral}`}>
                          {mention.sentiment_label}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SOV Contribution card */}
          <div className="border rounded-xl p-5 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Press SOV Contribution</h3>
            </div>
            {latestSov ? (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    Share of press coverage voice · {fmtDate(latestSov.snapshot_date)}
                  </p>
                  <p className="text-3xl font-bold">{latestSov.press_sov?.toFixed(1)}%</p>
                </div>
                <div className="h-2.5 flex-1 min-w-[120px] rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${latestSov.press_sov ?? 0}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Press SOV appears here after the nightly crawl runs. It shows {brand.name}&apos;s share of press coverage versus tracked competitors.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Calculated nightly at 7 AM Lagos time. Based on estimated readership across all monitored publications.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
