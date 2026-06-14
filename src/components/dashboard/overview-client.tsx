'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Minus, Activity,
  Megaphone, CalendarDays, MapPin, ClipboardList,
  Plus, ArrowRight, Zap, ArrowUpRight,
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
  brandName: string
  category:  string | null
  bhi:       BHIResult
  sparkline: { date: string; score: number }[]
  sentiment: SentimentRow | null
  sovScore:  number | null
  sovDate:   string | null
  activeCampaigns:  Campaign[]
  upcomingEvents:   Event[]
  recentMentions:   Mention[]
  hasAnyData: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function fmtMoney(amount: number | null, currency = 'NGN') {
  if (!amount) return null
  return `${currency} ${Number(amount).toLocaleString('en-NG')}`
}

const EVENT_STATUS: Record<string, string> = {
  planned:  'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  live:     'bg-green-500/15 text-green-400 border border-green-500/20',
  closed:   'bg-muted/60 text-muted-foreground',
  reported: 'bg-violet-500/15 text-violet-400 border border-violet-500/20',
}

const CAMPAIGN_STATUS: Record<string, string> = {
  active:    'bg-green-500/15 text-green-400 border border-green-500/20',
  paused:    'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  draft:     'bg-muted/60 text-muted-foreground',
  completed: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
}

const SENTIMENT_COLOUR: Record<string, string> = {
  positive: 'text-green-400',
  neutral:  'text-muted-foreground',
  negative: 'text-red-400',
  mixed:    'text-amber-400',
}

const PLATFORM_LABEL: Record<string, string> = { twitter: 'X', instagram: 'IG' }

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0  },
}

const stagger = (delay = 0) => ({
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: delay } },
})

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        'rounded-2xl border bg-card p-5 space-y-1 card-hover',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

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
    <div className="space-y-5">
      {/* ── Brand header ─────────────────────────────────────────────── */}
      <motion.div
        className="flex items-center justify-between gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{brandName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{category ?? 'Overview'}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {[
            { label: 'Campaign', href: '/dashboard/campaigns/new' },
            { label: 'Event',    href: '/dashboard/events/new'    },
            { label: 'OOH site', href: '/dashboard/ooh/new'       },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted/60 hover:border-border/80 transition-all duration-150 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              {label}
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ── Top 3 stat cards ─────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start"
        variants={stagger(0.1)}
        initial="hidden"
        animate="visible"
      >
        {/* BHI card */}
        <StatCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand Health Index</p>
            <Link href="/dashboard/brand-equity" className="text-muted-foreground/60 hover:text-foreground transition-colors">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {hasAnyData ? (
            <BHIGauge bhi={bhi} sparkline={sparkline} />
          ) : (
            <div className="py-8 text-center space-y-2">
              <Activity className="h-7 w-7 text-muted-foreground/20 mx-auto" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect social accounts and run a survey to see your BHI.
              </p>
            </div>
          )}
        </StatCard>

        {/* Sentiment card */}
        <StatCard>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sentiment</p>
            <Link href="/dashboard/sentiment" className="text-muted-foreground/60 hover:text-foreground transition-colors">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {sentiment !== null ? (
            <div className="space-y-4">
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold tabular-nums tracking-tight">
                  {Math.round(sentiment.social_score)}
                </span>
                <div className="pb-2 flex items-center gap-1 text-muted-foreground">
                  {sentiment.social_score >= 60
                    ? <TrendingUp className="h-4 w-4 text-green-400" />
                    : sentiment.social_score <= 40
                    ? <TrendingDown className="h-4 w-4 text-red-400" />
                    : <Minus className="h-4 w-4" />
                  }
                  <span className="text-xs">/100</span>
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Positive</span>
                    <span className="text-green-400 font-medium">{Math.round(sentiment.positive_pct)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-green-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${sentiment.positive_pct}%` }}
                      transition={{ duration: 1, delay: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Negative</span>
                    <span className="text-red-400 font-medium">{Math.round(sentiment.negative_pct)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-red-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${sentiment.negative_pct}%` }}
                      transition={{ duration: 1, delay: 0.7, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/60">
                From {fmtDate(sentiment.day)}
              </p>
            </div>
          ) : (
            <div className="py-6 text-center space-y-1.5">
              <p className="text-4xl font-bold text-muted-foreground/20">—</p>
              <p className="text-xs text-muted-foreground">No crawl data. Go to Sentiment → Run crawl.</p>
            </div>
          )}
        </StatCard>

        {/* SOV card */}
        <StatCard>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Share of Voice</p>
            <Link href="/dashboard/content" className="text-muted-foreground/60 hover:text-foreground transition-colors">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {sovScore !== null ? (
            <div className="space-y-4">
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold tabular-nums tracking-tight">
                  {Math.round(sovScore)}
                </span>
                <span className="pb-2 text-2xl font-medium text-muted-foreground">%</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Social SOV</p>
                <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(sovScore, 100)}%` }}
                    transition={{ duration: 1, delay: 0.7, ease: 'easeOut' }}
                  />
                </div>
              </div>
              {sovDate && (
                <p className="text-[10px] text-muted-foreground/60">
                  From {fmtDate(sovDate)}
                </p>
              )}
            </div>
          ) : (
            <div className="py-6 text-center space-y-1.5">
              <p className="text-4xl font-bold text-muted-foreground/20">—</p>
              <p className="text-xs text-muted-foreground">SOV populates after first mention crawl.</p>
            </div>
          )}
        </StatCard>
      </motion.div>

      {/* ── Campaigns + Events ────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        variants={stagger(0.25)}
        initial="hidden"
        animate="visible"
      >
        {/* Active campaigns */}
        <motion.div variants={fadeUp} className="rounded-2xl border bg-card p-5 space-y-3 card-hover">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Active campaigns</p>
            </div>
            <Link href="/dashboard/campaigns" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {activeCampaigns.length === 0 ? (
            <div className="py-5 text-center space-y-2">
              <p className="text-xs text-muted-foreground">No active campaigns.</p>
              <Link href="/dashboard/campaigns/new" className="inline-flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground">
                <Plus className="h-3 w-3" /> Create campaign
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {activeCampaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/campaigns/${c.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(c.objectives ?? []).slice(0, 2).join(' · ')}
                      {c.start_date ? ` · from ${fmtDate(c.start_date)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.total_budget && (
                      <span className="text-xs text-muted-foreground">{fmtMoney(c.total_budget, c.currency ?? 'NGN')}</span>
                    )}
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CAMPAIGN_STATUS[c.status] ?? 'bg-muted/60 text-muted-foreground')}>
                      {c.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Upcoming events */}
        <motion.div variants={fadeUp} className="rounded-2xl border bg-card p-5 space-y-3 card-hover">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Upcoming events</p>
            </div>
            <Link href="/dashboard/events" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="py-5 text-center space-y-2">
              <p className="text-xs text-muted-foreground">No planned or live events.</p>
              <Link href="/dashboard/events/new" className="inline-flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground">
                <Plus className="h-3 w-3" /> Create event
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {upcomingEvents.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/dashboard/events/${ev.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">{ev.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ev.city}{ev.event_type ? ` · ${ev.event_type}` : ''} · {fmtDate(ev.date_start)}
                    </p>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', EVENT_STATUS[ev.status] ?? 'bg-muted/60 text-muted-foreground')}>
                    {ev.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* ── Recent mentions ───────────────────────────────────────────── */}
      {recentMentions.length > 0 && (
        <motion.div
          className="rounded-2xl border bg-card p-5 space-y-3 card-hover"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Recent mentions</p>
            <Link href="/dashboard/sentiment" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentMentions.map((m) => (
              <div key={m.id} className="rounded-xl border bg-muted/20 px-3.5 py-3 space-y-1.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0 uppercase tracking-wide">
                    {PLATFORM_LABEL[m.platform] ?? m.platform}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {m.author_handle ? `@${m.author_handle}` : 'unknown'}
                  </span>
                  {m.sentiment_label && (
                    <span className={cn('text-xs font-medium capitalize ml-auto shrink-0', SENTIMENT_COLOUR[m.sentiment_label] ?? '')}>
                      {m.sentiment_label}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed line-clamp-2 text-muted-foreground">{m.content}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Empty state quick actions ─────────────────────────────────── */}
      {!hasAnyData && (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          variants={stagger(0.4)}
          initial="hidden"
          animate="visible"
        >
          {[
            { icon: MapPin,        label: 'Add OOH site',   href: '/dashboard/ooh/new',    desc: 'Track outdoor placements'  },
            { icon: CalendarDays,  label: 'Create event',   href: '/dashboard/events/new', desc: 'Log activations & events'  },
            { icon: ClipboardList, label: 'Launch survey',  href: '/dashboard/surveys',    desc: 'Collect consumer feedback' },
            { icon: Zap,           label: 'Pre-Post check', href: '/dashboard/pre-post',   desc: 'Score content before posting' },
          ].map(({ icon: Icon, label, href, desc }) => (
            <motion.div key={label} variants={fadeUp}>
              <Link
                href={href}
                className="flex flex-col gap-3 rounded-2xl border bg-card p-4 hover:bg-muted/30 transition-all duration-150 hover:border-border/80 card-hover"
              >
                <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
