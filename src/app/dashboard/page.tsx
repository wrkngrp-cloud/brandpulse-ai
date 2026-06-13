import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Activity,
  Megaphone, CalendarDays, MapPin, ClipboardList,
  Plus, ArrowRight, Zap,
} from 'lucide-react'
import { computeBHI } from '@/lib/bhi'
import { BHIGauge } from '@/components/dashboard/bhi-gauge'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function TrendIcon({ value, threshold = 50 }: { value: number | null; threshold?: number }) {
  if (value === null) return null
  if (value >= threshold + 10) return <TrendingUp className="h-4 w-4 text-green-600" />
  if (value <= threshold - 10) return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function fmtMoney(amount: number | null, currency = 'NGN') {
  if (!amount) return null
  return `${currency} ${Number(amount).toLocaleString('en-NG')}`
}

const EVENT_STATUS: Record<string, string> = {
  planned:  'bg-blue-100 text-blue-800',
  live:     'bg-green-100 text-green-800',
  closed:   'bg-muted text-muted-foreground',
  reported: 'bg-purple-100 text-purple-800',
}

const CAMPAIGN_STATUS: Record<string, string> = {
  active:    'bg-green-100 text-green-800',
  paused:    'bg-amber-100 text-amber-800',
  draft:     'bg-muted text-muted-foreground',
  completed: 'bg-blue-100 text-blue-800',
}

async function DashboardContent() {
  const supabase = await createClient()

  const [
    { data: brand },
    { data: sentimentRow },
    { data: sovRow },
    { data: surveyResponses },
    { data: bhiHistory },
    { data: recentMentions },
    { data: activeCampaigns },
    { data: upcomingEvents },
  ] = await Promise.all([
    supabase.from('brands').select('id, name, category').limit(1).single(),
    supabase.from('sentiment_daily').select('social_score, day, positive_pct, negative_pct').order('day', { ascending: false }).limit(1).single(),
    supabase.from('sov_snapshots').select('social_sov, snapshot_date').order('snapshot_date', { ascending: false }).limit(1).single(),
    supabase.from('survey_responses').select('answers, quality_flag').eq('quality_flag', 'ok'),
    supabase.from('brand_health_snapshots').select('bhi, snapshot_date').order('snapshot_date', { ascending: false }).limit(30),
    supabase.from('mentions').select('id, content, author_handle, platform, sentiment_label, created_at').order('created_at', { ascending: false }).limit(4),
    supabase.from('campaigns').select('id, name, status, objectives, start_date, end_date, total_budget, currency').in('status', ['active', 'paused']).order('created_at', { ascending: false }).limit(3),
    supabase.from('events').select('id, name, status, city, date_start, date_end, event_type, budget, currency').in('status', ['planned', 'live']).order('date_start', { ascending: true }).limit(3),
  ])

  const npsScores = (surveyResponses ?? [])
    .map(r => (r.answers as Record<string, unknown>)?.q2 as number | undefined)
    .filter((s): s is number => typeof s === 'number' && s >= 0 && s <= 10)
  const avgNps = npsScores.length ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length : null
  const surveyScore = avgNps !== null ? avgNps * 10 : null

  const sentimentScore = sentimentRow?.social_score ?? null
  const sovScore       = sovRow?.social_sov ?? null
  const bhi = computeBHI({ sentimentScore, sovScore, surveyScore })

  const sparkline = [...(bhiHistory ?? [])]
    .reverse()
    .map(r => ({ date: r.snapshot_date, score: Number(r.bhi) }))

  const hasAnyData = sentimentScore !== null || sovScore !== null || surveyScore !== null

  const SENTIMENT_COLOURS: Record<string, string> = {
    positive: 'text-green-600',
    neutral:  'text-muted-foreground',
    negative: 'text-red-500',
    mixed:    'text-amber-500',
  }
  const PLATFORM_LABEL: Record<string, string> = { twitter: 'X', instagram: 'IG' }

  return (
    <div className="space-y-6">
      {/* Brand header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{brand?.name ?? 'Your brand'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{brand?.category ?? 'Overview'}</p>
        </div>
        {/* Quick actions */}
        <div className="hidden sm:flex items-center gap-2">
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Campaign
          </Link>
          <Link
            href="/dashboard/events/new"
            className="inline-flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Event
          </Link>
          <Link
            href="/dashboard/ooh/new"
            className="inline-flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            OOH site
          </Link>
        </div>
      </div>

      {/* Main stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
        {/* BHI card */}
        <div className="border rounded-xl p-5 bg-card space-y-1">
          <p className="text-sm text-muted-foreground font-medium">Brand Health Index</p>
          {hasAnyData ? (
            <BHIGauge bhi={bhi} sparkline={sparkline} />
          ) : (
            <div className="py-8 text-center space-y-1">
              <Activity className="h-6 w-6 text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground">
                Connect social accounts and run at least one survey to see your BHI.
              </p>
            </div>
          )}
        </div>

        {/* Sentiment card */}
        <div className="border rounded-xl p-5 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">Sentiment Score</p>
            <Link href="/dashboard/sentiment" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              View <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {sentimentScore !== null ? (
            <>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-bold">{Math.round(sentimentScore)}</p>
                <TrendIcon value={sentimentScore} />
              </div>
              <p className="text-xs text-muted-foreground">out of 100</p>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Positive</span>
                  <span className="text-green-600 font-medium">{Math.round(sentimentRow!.positive_pct)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${sentimentRow!.positive_pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Negative</span>
                  <span className="text-red-500 font-medium">{Math.round(sentimentRow!.negative_pct)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${sentimentRow!.negative_pct}%` }} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                From {new Date(sentimentRow!.day).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </p>
            </>
          ) : (
            <div className="py-6 text-center space-y-1">
              <p className="text-3xl font-bold text-muted-foreground/30">—</p>
              <p className="text-xs text-muted-foreground">No crawl data yet. Go to Sentiment and click Run crawl now.</p>
            </div>
          )}
        </div>

        {/* SOV card */}
        <div className="border rounded-xl p-5 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">Share of Voice</p>
            <Link href="/dashboard/content" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              View <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {sovScore !== null ? (
            <>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-bold">{Math.round(sovScore)}%</p>
                <TrendIcon value={sovScore} threshold={25} />
              </div>
              <p className="text-xs text-muted-foreground">social SOV</p>
              <p className="text-[10px] text-muted-foreground pt-1">
                From {new Date(sovRow!.snapshot_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </p>
            </>
          ) : (
            <div className="py-6 text-center space-y-1">
              <p className="text-3xl font-bold text-muted-foreground/30">—</p>
              <p className="text-xs text-muted-foreground">SOV is computed after the first mention crawl</p>
            </div>
          )}
        </div>
      </div>

      {/* Second row: Active campaigns + Upcoming events */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Active campaigns */}
        <div className="border rounded-xl p-5 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Active campaigns</p>
            </div>
            <Link href="/dashboard/campaigns" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {(activeCampaigns ?? []).length === 0 ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground">No active campaigns yet.</p>
              <Link href="/dashboard/campaigns/new" className="inline-flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1 hover:bg-muted transition-colors">
                <Plus className="h-3 w-3" /> Create campaign
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {activeCampaigns!.map(c => {
                const objectives = (c.objectives as string[] | null) ?? []
                return (
                  <Link
                    key={c.id}
                    href={`/dashboard/campaigns/${c.id}`}
                    className="flex items-center gap-3 hover:bg-muted/40 rounded-lg px-2 py-2 -mx-2 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {objectives.slice(0, 2).join(' · ')}
                        {c.start_date ? ` · from ${fmtDate(c.start_date)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.total_budget && (
                        <span className="text-xs text-muted-foreground">{fmtMoney(c.total_budget, c.currency)}</span>
                      )}
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', CAMPAIGN_STATUS[c.status] ?? 'bg-muted text-muted-foreground')}>
                        {c.status}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming events */}
        <div className="border rounded-xl p-5 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Upcoming events</p>
            </div>
            <Link href="/dashboard/events" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {(upcomingEvents ?? []).length === 0 ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground">No planned or live events.</p>
              <Link href="/dashboard/events/new" className="inline-flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1 hover:bg-muted transition-colors">
                <Plus className="h-3 w-3" /> Create event
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents!.map(ev => (
                <Link
                  key={ev.id}
                  href={`/dashboard/events/${ev.id}`}
                  className="flex items-center gap-3 hover:bg-muted/40 rounded-lg px-2 py-2 -mx-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ev.city}
                      {ev.event_type ? ` · ${ev.event_type}` : ''}
                      {` · ${fmtDate(ev.date_start)}`}
                    </p>
                  </div>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0', EVENT_STATUS[ev.status] ?? 'bg-muted text-muted-foreground')}>
                    {ev.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent mentions */}
      {(recentMentions ?? []).length > 0 && (
        <div className="border rounded-xl p-5 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Recent mentions</p>
            <Link href="/dashboard/sentiment" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentMentions!.map(m => (
              <div key={m.id} className="border rounded-xl px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {PLATFORM_LABEL[m.platform] ?? m.platform}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {m.author_handle ? `@${m.author_handle}` : 'unknown'}
                  </span>
                  {m.sentiment_label && (
                    <span className={cn('text-xs font-medium capitalize ml-auto shrink-0', SENTIMENT_COLOURS[m.sentiment_label] ?? '')}>
                      {m.sentiment_label}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-snug line-clamp-2 text-muted-foreground">{m.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick action cards when empty */}
      {!hasAnyData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: MapPin,       label: 'Add OOH site',    href: '/dashboard/ooh/new',        desc: 'Track outdoor placements' },
            { icon: CalendarDays, label: 'Create event',    href: '/dashboard/events/new',     desc: 'Log activations & events' },
            { icon: ClipboardList,label: 'Launch survey',   href: '/dashboard/surveys',        desc: 'Collect consumer feedback' },
            { icon: Zap,          label: 'Pre-Post check',  href: '#',                         desc: 'Score content before posting', action: true },
          ].map(a => (
            <Link
              key={a.label}
              href={a.href}
              className="border rounded-xl p-4 hover:bg-muted/40 transition-colors space-y-2"
            >
              <a.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
