'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Minus,
  Megaphone, CalendarDays, MapPin, ClipboardList,
  Plus, ArrowRight, Zap, ArrowUpRight, Activity,
  BarChart2, Radio, MessageSquare,
} from 'lucide-react'
import { BHIGauge }   from '@/components/dashboard/bhi-gauge'
import { StatCard }   from '@/components/dashboard/stat-card'
import { TrendChart } from '@/components/dashboard/trend-chart'
import { cn }         from '@/lib/utils'
import { fadeUp, stagger } from '@/lib/motion'
import type { BHIResult } from '@/lib/bhi'

// ── Types ──────────────────────────────────────────────────────────────────

interface Campaign {
  id: string
  name: string
  status: string
  objectives: string[] | null
  start_date: string | null
  total_budget: number | null
  currency: string | null
}

interface Event {
  id: string
  name: string
  status: string
  city: string | null
  date_start: string
  event_type: string | null
}

interface Mention {
  id: string
  content: string | null
  author_handle: string | null
  platform: string
  sentiment_label: string | null
  created_at: string
}

interface SentimentRow {
  social_score: number
  day: string
  positive_pct: number
  negative_pct: number
}

export interface OverviewProps {
  brandName:       string
  category:        string | null
  bhi:             BHIResult
  sparkline:       { date: string; score: number }[]
  sentiment:       SentimentRow | null
  sovScore:        number | null
  sovDate:         string | null
  activeCampaigns: Campaign[]
  upcomingEvents:  Event[]
  recentMentions:  Mention[]
  hasAnyData:      boolean
  trendData?:      { date: string; bhi: number | null; sentiment: number | null }[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function fmtCompact(n: number, currency = 'NGN') {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${currency} ${(n / 1_000).toFixed(0)}k`
  return `${currency} ${n}`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const STATUS_DOT: Record<string, string> = {
  active:    'bg-green-400',
  paused:    'bg-amber-400',
  draft:     'bg-muted-foreground/30',
  completed: 'bg-blue-400',
}

const EVENT_STATUS_DOT: Record<string, string> = {
  planned:  'bg-blue-400',
  live:     'bg-green-400',
  closed:   'bg-muted-foreground/30',
  reported: 'bg-violet-400',
}

const PLATFORM_LABEL: Record<string, string> = { twitter: 'X', instagram: 'IG' }

const SENTIMENT_COLOUR: Record<string, string> = {
  positive: 'text-green-500',
  neutral:  'text-muted-foreground',
  negative: 'text-red-500',
  mixed:    'text-amber-500',
}

// ── Card shell ─────────────────────────────────────────────────────────────

function Card({
  children,
  className,
  accent,
}: {
  children: React.ReactNode
  className?: string
  accent?: 'blue' | 'green' | 'amber' | 'clay' | 'red'
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        'rounded-2xl border bg-card overflow-hidden card-shadow card-hover',
        accent && `card-accent-${accent}`,
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('eyebrow select-none', className)}>
      {children}
    </p>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export function OverviewClient({
  brandName,
  category,
  bhi,
  sparkline,
  sentiment,
  sovScore,
  sovDate,
  activeCampaigns,
  upcomingEvents,
  recentMentions,
  hasAnyData,
  trendData = [],
}: OverviewProps) {
  // Sparkline data for BHI stat card
  const bhiSpark = sparkline.map(s => ({ date: s.date, value: s.score }))
  const hasTrend = trendData.length > 1

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* ── Page header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-end justify-between gap-4"
      >
        <div>
          <p className="eyebrow mb-1.5">{getGreeting()}</p>
          <h1 className="h-display text-[30px] sm:text-[34px] leading-none">{brandName}</h1>
          {category && (
            <p className="mt-2 text-[13px] text-muted-foreground/60">{category}</p>
          )}
        </div>

        {/* ONE clay CTA */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/campaigns"
            className="text-[12.5px] text-muted-foreground hover:text-foreground border border-border rounded-xl px-3.5 py-2 transition-colors hover:bg-muted/50"
          >
            View all
          </Link>
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white rounded-xl px-4 py-2 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #E8763E 0%, #C4501D 100%)', boxShadow: '0 4px 14px -4px oklch(0.585 0.163 37 / 0.55)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Campaign
          </Link>
        </div>
      </motion.div>

      {/* ── KPI stat row ─────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        variants={stagger(0.05)}
        initial="hidden"
        animate="visible"
      >
        <StatCard
          label="Brand Health"
          value={bhi.score !== null ? Math.round(bhi.score) : null}
          suffix="/100"
          tone="blue"
          icon={Activity}
          spark={bhiSpark.length > 1 ? bhiSpark : undefined}
          deltaLabel="30-day trend"
        />
        <StatCard
          label="Sentiment Score"
          value={sentiment ? Math.round(sentiment.social_score) : null}
          suffix="/100"
          tone={sentiment && sentiment.social_score >= 60 ? 'green' : sentiment && sentiment.social_score <= 40 ? 'clay' : 'amber'}
          icon={BarChart2}
          deltaLabel={sentiment ? `from ${fmtDate(sentiment.day)}` : undefined}
        />
        <StatCard
          label="Share of Voice"
          value={sovScore !== null ? Math.round(sovScore) : null}
          suffix="%"
          tone="violet"
          icon={Radio}
          deltaLabel={sovDate ? `as of ${fmtDate(sovDate)}` : undefined}
        />
        <StatCard
          label="Recent Mentions"
          value={recentMentions.length}
          tone="amber"
          icon={MessageSquare}
          deltaLabel="last 7 days"
        />
      </motion.div>

      {/* ── 30-Day Pulse trend chart ─────────────────────────────── */}
      {hasTrend && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border bg-card card-shadow p-5 sm:p-6"
        >
          <TrendChart data={trendData} height={200} />
        </motion.div>
      )}

      {/* ── Main bento grid ──────────────────────────────────────── */}
      <motion.div
        className="bento-overview"
        variants={stagger(0.08)}
        initial="hidden"
        animate="visible"
      >

        {/* BHI gauge — tall left card */}
        <Card accent="blue" className="bento-bhi p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label>Brand Health Index</Label>
            <Link href="/dashboard/brand-equity" className="text-muted-foreground/40 hover:text-foreground transition-colors">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {hasAnyData ? (
            <div className="flex-1 flex items-center justify-center">
              <BHIGauge bhi={bhi} sparkline={sparkline} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
              <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center">
                <Activity className="h-6 w-6 text-muted-foreground/25" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">No data yet</p>
                <p className="text-[11px] text-muted-foreground/55 max-w-[160px] leading-relaxed">
                  Connect social accounts and run a survey to see your BHI.
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Sentiment */}
        <Card
          accent={
            sentiment === null ? undefined
            : sentiment.social_score >= 60 ? 'green'
            : sentiment.social_score <= 40 ? 'red'
            : 'amber'
          }
          className="bento-sentiment p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <Label>Sentiment Score</Label>
            <Link href="/dashboard/sentiment" className="text-muted-foreground/40 hover:text-foreground transition-colors">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {sentiment !== null ? (
            <div className="flex items-start gap-6">
              <div className="shrink-0">
                <div className="metric text-[60px] leading-none">
                  {Math.round(sentiment.social_score)}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {sentiment.social_score >= 60
                    ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    : sentiment.social_score <= 40
                    ? <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    : <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />
                  }
                  <span className="text-[12px] text-muted-foreground/55">/ 100</span>
                </div>
              </div>

              <div className="flex-1 space-y-3 pt-1.5">
                {[
                  { label: 'Positive', pct: sentiment.positive_pct, color: 'bg-green-500' },
                  { label: 'Negative', pct: sentiment.negative_pct, color: 'bg-red-500'   },
                ].map(row => (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-muted-foreground">{row.label}</span>
                      <span className={cn('text-[12px] font-semibold', row.label === 'Positive' ? 'text-green-500' : 'text-red-500')}>
                        {Math.round(row.pct)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full', row.color)}
                        initial={{ width: 0 }}
                        animate={{ width: `${row.pct}%` }}
                        transition={{ duration: 1.1, delay: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[10.5px] text-muted-foreground/40 pt-0.5">from {fmtDate(sentiment.day)}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center gap-1 py-3">
              <span className="metric text-[60px] leading-none text-muted-foreground/12">—</span>
              <p className="text-[12.5px] text-muted-foreground mt-1">No crawl data yet. Run a crawl from Sentiment.</p>
            </div>
          )}
        </Card>

        {/* SOV */}
        <Card accent="blue" className="bento-sov p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <Label>Share of Voice</Label>
            <Link href="/dashboard/content" className="text-muted-foreground/40 hover:text-foreground transition-colors">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {sovScore !== null ? (
            <>
              <div className="mt-2">
                <div className="flex items-baseline gap-1">
                  <span className="metric text-[52px] leading-none">{Math.round(sovScore)}</span>
                  <span className="metric text-[24px] text-muted-foreground/40 pb-1">%</span>
                </div>
                <p className="text-[11.5px] text-muted-foreground mt-1.5">
                  Social share of voice{sovDate ? ` · ${fmtDate(sovDate)}` : ''}
                </p>
              </div>
              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mt-4">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #6B8FFF 0%, #2B59FF 100%)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(sovScore, 100)}%` }}
                  transition={{ duration: 1.1, delay: 0.6, ease: 'easeOut' }}
                />
              </div>
            </>
          ) : (
            <>
              <span className="metric text-[52px] leading-none text-muted-foreground/12 mt-2">—</span>
              <p className="text-[12px] text-muted-foreground mt-2">
                SOV populates after first mention crawl.
              </p>
            </>
          )}
        </Card>

        {/* Events */}
        <Card className="bento-events p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <Label>Upcoming Events</Label>
            <Link href="/dashboard/events" className="text-muted-foreground/40 hover:text-foreground transition-colors">
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-4">
              <CalendarDays className="h-7 w-7 text-muted-foreground/18" />
              <p className="text-[12.5px] text-muted-foreground">No planned or live events.</p>
              <Link
                href="/dashboard/events/new"
                className="inline-flex items-center gap-1 text-[11px] border border-border rounded-xl px-2.5 py-1.5 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground mt-1"
              >
                <Plus className="h-3 w-3" /> Create event
              </Link>
            </div>
          ) : (
            <div className="space-y-0.5 flex-1">
              {upcomingEvents.slice(0, 4).map(ev => (
                <Link
                  key={ev.id}
                  href={`/dashboard/events/${ev.id}`}
                  className="flex items-start gap-2.5 py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/30 -mx-5 px-5 transition-colors group"
                >
                  <div className={cn('h-2 w-2 rounded-full mt-[5px] shrink-0', EVENT_STATUS_DOT[ev.status] ?? 'bg-muted-foreground/30')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate group-hover:text-foreground transition-colors">{ev.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {ev.city ? `${ev.city} · ` : ''}{fmtDate(ev.date_start)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Campaigns */}
        <Card accent="clay" className="bento-campaigns p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 text-muted-foreground/50" />
              <Label>Active Campaigns</Label>
            </div>
            <Link href="/dashboard/campaigns" className="flex items-center gap-0.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
              All <ArrowRight className="h-3 w-3 ml-0.5" />
            </Link>
          </div>

          {activeCampaigns.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <p className="text-[12.5px] text-muted-foreground">No active campaigns. Create your first one.</p>
              <Link
                href="/dashboard/campaigns/new"
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white rounded-xl px-4 py-2 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #E8763E 0%, #C4501D 100%)' }}
              >
                <Plus className="h-3.5 w-3.5" /> New campaign
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {activeCampaigns.map(c => (
                <Link
                  key={c.id}
                  href={`/dashboard/campaigns/${c.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-muted/30 -mx-5 px-5 transition-colors group"
                >
                  <div className={cn('h-2 w-2 rounded-full shrink-0', STATUS_DOT[c.status] ?? 'bg-muted-foreground/30')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate group-hover:text-foreground transition-colors">
                      {c.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {(c.objectives ?? []).slice(0, 2).join(' · ')}
                      {c.start_date ? ` · from ${fmtDate(c.start_date)}` : ''}
                    </p>
                  </div>
                  {c.total_budget !== null && c.total_budget > 0 && (
                    <span className="metric text-[14px] text-muted-foreground/70 shrink-0">
                      {fmtCompact(c.total_budget, c.currency ?? 'NGN')}
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/25 group-hover:text-muted-foreground transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent mentions */}
        {recentMentions.length > 0 && (
          <Card className="bento-full p-5">
            <div className="flex items-center justify-between mb-4">
              <Label>Recent Mentions</Label>
              <Link href="/dashboard/sentiment" className="flex items-center gap-0.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                All <ArrowRight className="h-3 w-3 ml-0.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentMentions.map(m => (
                <div
                  key={m.id}
                  className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3 space-y-2 hover:bg-muted/35 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0 uppercase tracking-wider">
                      {PLATFORM_LABEL[m.platform] ?? m.platform}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {m.author_handle ? `@${m.author_handle}` : 'unknown'}
                    </span>
                    {m.sentiment_label && (
                      <span className={cn('text-[11px] font-semibold capitalize ml-auto shrink-0', SENTIMENT_COLOUR[m.sentiment_label] ?? '')}>
                        {m.sentiment_label}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] leading-relaxed line-clamp-2 text-muted-foreground/80">{m.content}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Empty state */}
        {!hasAnyData && (
          <Card className="bento-full p-6">
            <p className="eyebrow mb-4">Let&apos;s get your first signal in</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: MapPin,        label: 'Add OOH Site',   href: '/dashboard/ooh/new',    desc: 'Track outdoor placements'   },
                { icon: CalendarDays,  label: 'Create Event',   href: '/dashboard/events/new', desc: 'Log activations and events' },
                { icon: ClipboardList, label: 'Launch Survey',  href: '/dashboard/surveys',    desc: 'Collect consumer feedback'  },
                { icon: Zap,           label: 'Pre-Post Check', href: '/dashboard/pre-post',   desc: 'Score content before live'  },
              ].map(({ icon: Icon, label, href, desc }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 hover:bg-muted/35 hover:border-border transition-all card-hover"
                >
                  <div className="h-9 w-9 rounded-xl bg-muted/70 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-muted-foreground/65" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold">{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

      </motion.div>
    </div>
  )
}
