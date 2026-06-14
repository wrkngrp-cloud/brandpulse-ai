'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Minus,
  Megaphone, CalendarDays, MapPin, ClipboardList,
  Plus, ArrowRight, Zap, ArrowUpRight, Activity,
} from 'lucide-react'
import { BHIGauge } from '@/components/dashboard/bhi-gauge'
import { cn } from '@/lib/utils'
import type { BHIResult } from '@/lib/bhi'

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function fmtCompact(n: number, currency = 'NGN') {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${currency} ${(n / 1_000).toFixed(0)}k`
  return `${currency} ${n}`
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
  positive: 'text-green-400',
  neutral:  'text-muted-foreground',
  negative: 'text-red-400',
  mixed:    'text-amber-400',
}

// ── Animation ─────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
}

const stagger = (delay = 0) => ({
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: delay } },
})

// ── Card shell ─────────────────────────────────────────────────────────────────

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
        'rounded-2xl border bg-card overflow-hidden relative card-hover card-shadow',
        accent && `card-accent-${accent}`,
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

// ── Mini label ────────────────────────────────────────────────────────────────

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 select-none', className)}>
      {children}
    </p>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

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
}: OverviewProps) {
  return (
    <div className="space-y-5 max-w-[1360px]">

      {/* ── Editorial header ─────────────────────────────────────── */}
      <motion.div
        className="flex items-end justify-between gap-4 pb-1"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground/50 mb-0.5 select-none">
            {category ?? 'Dashboard'}
          </p>
          <h1 className="metric text-3xl leading-none">{brandName}</h1>
        </div>

        {/* Quick actions — ONE clay CTA */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/campaigns"
            className="text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 transition-colors hover:bg-muted/50"
          >
            View all
          </Link>
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3.5 py-1.5 transition-all hover:opacity-90"
            style={{ background: 'oklch(0.585 0.163 37)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Campaign
          </Link>
        </div>
      </motion.div>

      {/* ── Bento grid ────────────────────────────────────────────── */}
      <motion.div
        className="bento-overview"
        variants={stagger(0.05)}
        initial="hidden"
        animate="visible"
      >

        {/* ─── BHI — tall left card ──────────────────────────── */}
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
                <Activity className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">No data yet</p>
                <p className="text-[11px] text-muted-foreground/60 max-w-[160px] leading-relaxed">
                  Connect social accounts and run a survey to see your BHI.
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* ─── Sentiment — wide horizontal layout ────────────── */}
        <Card
          accent={
            sentiment === null ? undefined
            : sentiment.social_score >= 60 ? 'green'
            : sentiment.social_score <= 40 ? 'red'
            : 'amber'
          }
          className="bento-sentiment p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <Label>Sentiment Score</Label>
            <Link href="/dashboard/sentiment" className="text-muted-foreground/40 hover:text-foreground transition-colors">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {sentiment !== null ? (
            <div className="flex items-start gap-6">
              {/* Big number */}
              <div className="shrink-0">
                <div className="metric text-[64px] leading-none">
                  {Math.round(sentiment.social_score)}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {sentiment.social_score >= 60
                    ? <TrendingUp className="h-3.5 w-3.5 text-green-400" />
                    : sentiment.social_score <= 40
                    ? <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                    : <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />
                  }
                  <span className="text-xs text-muted-foreground/60">/ 100</span>
                </div>
              </div>

              {/* Breakdown bars */}
              <div className="flex-1 space-y-3 pt-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Positive</span>
                    <span className="text-xs font-semibold text-green-400">{Math.round(sentiment.positive_pct)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-green-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${sentiment.positive_pct}%` }}
                      transition={{ duration: 1.1, delay: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Negative</span>
                    <span className="text-xs font-semibold text-red-400">{Math.round(sentiment.negative_pct)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-red-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${sentiment.negative_pct}%` }}
                      transition={{ duration: 1.1, delay: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/40 pt-1">from {fmtDate(sentiment.day)}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center gap-1 py-3">
              <span className="metric text-[64px] leading-none text-muted-foreground/15">—</span>
              <p className="text-xs text-muted-foreground">No crawl data. Go to Sentiment → Run crawl.</p>
            </div>
          )}
        </Card>

        {/* ─── SOV — square, giant number ────────────────────── */}
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
                <div className="flex items-end gap-1.5">
                  <span className="metric text-[56px] leading-none">{Math.round(sovScore)}</span>
                  <span className="text-2xl text-muted-foreground/50 pb-1 metric">%</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Social share of voice{sovDate ? ` · ${fmtDate(sovDate)}` : ''}
                </p>
              </div>
              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mt-4">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'oklch(0.55 0.25 258)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(sovScore, 100)}%` }}
                  transition={{ duration: 1.1, delay: 0.6, ease: 'easeOut' }}
                />
              </div>
            </>
          ) : (
            <>
              <span className="metric text-[56px] leading-none text-muted-foreground/15 mt-2">—</span>
              <p className="text-xs text-muted-foreground mt-2">
                SOV populates after first mention crawl.
              </p>
            </>
          )}
        </Card>

        {/* ─── Events mini ───────────────────────────────────── */}
        <Card className="bento-events p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <Label>Upcoming Events</Label>
            <Link href="/dashboard/events" className="text-muted-foreground/40 hover:text-foreground transition-colors">
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-4">
              <CalendarDays className="h-7 w-7 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">No planned or live events.</p>
              <Link
                href="/dashboard/events/new"
                className="inline-flex items-center gap-1 text-[11px] border rounded-lg px-2.5 py-1 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Create
              </Link>
            </div>
          ) : (
            <div className="space-y-1 flex-1">
              {upcomingEvents.slice(0, 4).map(ev => (
                <Link
                  key={ev.id}
                  href={`/dashboard/events/${ev.id}`}
                  className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0 hover:bg-muted/30 -mx-5 px-5 transition-colors group"
                >
                  <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', EVENT_STATUS_DOT[ev.status] ?? 'bg-muted-foreground/30')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate group-hover:text-foreground transition-colors">{ev.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {ev.city ? `${ev.city} · ` : ''}{fmtDate(ev.date_start)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* ─── Campaigns — full width list ───────────────────── */}
        <Card accent="clay" className="bento-campaigns p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground/60" />
              <Label>Active Campaigns</Label>
            </div>
            <Link href="/dashboard/campaigns" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {activeCampaigns.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <p className="text-xs text-muted-foreground">No active campaigns. Create your first one.</p>
              <Link
                href="/dashboard/campaigns/new"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3.5 py-1.5"
                style={{ background: 'oklch(0.585 0.163 37)' }}
              >
                <Plus className="h-3.5 w-3.5" /> New campaign
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {activeCampaigns.map(c => (
                <Link
                  key={c.id}
                  href={`/dashboard/campaigns/${c.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-muted/30 -mx-5 px-5 transition-colors group"
                >
                  {/* Status dot */}
                  <div className={cn('h-2 w-2 rounded-full shrink-0', STATUS_DOT[c.status] ?? 'bg-muted-foreground/30')} />

                  {/* Name + objectives */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium truncate group-hover:text-foreground transition-colors">
                      {c.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {(c.objectives ?? []).slice(0, 2).join(' · ')}
                      {c.start_date ? ` · from ${fmtDate(c.start_date)}` : ''}
                    </p>
                  </div>

                  {/* Budget */}
                  {c.total_budget !== null && c.total_budget > 0 && (
                    <span className="metric text-[15px] text-muted-foreground shrink-0">
                      {fmtCompact(c.total_budget, c.currency ?? 'NGN')}
                    </span>
                  )}

                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* ─── Recent mentions ────────────────────────────────── */}
        {recentMentions.length > 0 && (
          <Card className="bento-full p-5">
            <div className="flex items-center justify-between mb-4">
              <Label>Recent Mentions</Label>
              <Link href="/dashboard/sentiment" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentMentions.map(m => (
                <div
                  key={m.id}
                  className="rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3 space-y-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 uppercase tracking-wide">
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
                  <p className="text-xs leading-relaxed line-clamp-2 text-muted-foreground">{m.content}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ─── Empty state quick actions ───────────────────────── */}
        {!hasAnyData && (
          <Card className="bento-full p-5">
            <Label className="mb-4">Get started</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: MapPin,        label: 'Add OOH Site',  href: '/dashboard/ooh/new',    desc: 'Track outdoor placements'  },
                { icon: CalendarDays,  label: 'Create Event',  href: '/dashboard/events/new', desc: 'Log activations & events'  },
                { icon: ClipboardList, label: 'Launch Survey', href: '/dashboard/surveys',    desc: 'Collect consumer feedback' },
                { icon: Zap,           label: 'Pre-Post Check',href: '/dashboard/pre-post',   desc: 'Score content before live' },
              ].map(({ icon: Icon, label, href, desc }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 hover:bg-muted/30 hover:border-border transition-all card-hover"
                >
                  <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-muted-foreground/70" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
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
