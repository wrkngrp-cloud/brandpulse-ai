'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, Radio, Activity } from 'lucide-react'

interface PortalData {
  brand:      { name: string; category: string | null; logo_url: string | null }
  sections:   string[]
  sentiment:  { social_score: number; day: string; positive_pct: number; negative_pct: number }[] | null
  sov:        { social_sov: number; snapshot_date: string } | null
  bhiHistory: { bhi: number; snapshot_date: string }[] | null
  asOf:       string
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

export function PortalClient({ data }: { data: PortalData }) {
  const { brand, sections, sentiment, sov, bhiHistory } = data

  const latestSentiment = sentiment?.[0]?.social_score ?? null
  const latestBhi = bhiHistory?.[0]?.bhi ?? null

  const sentimentTrend = [...(sentiment ?? [])].reverse().map(r => ({
    date: r.day,
    score: r.social_score,
    pos: r.positive_pct,
    neg: r.negative_pct,
  }))

  const bhiTrend = [...(bhiHistory ?? [])].reverse().map(r => ({
    date: r.snapshot_date,
    bhi: Number(r.bhi),
  }))

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {brand.logo_url && (
              <div className="h-8 w-8 rounded-lg overflow-hidden border bg-muted shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.logo_url} alt="" className="h-full w-full object-contain" />
              </div>
            )}
            <div>
              <p className="font-semibold text-[15px] leading-tight">{brand.name}</p>
              {brand.category && <p className="text-[11px] text-muted-foreground">{brand.category}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Brand Intelligence Portal</p>
            <p className="text-[11px] text-muted-foreground">As of {new Date(data.asOf).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {sections.includes('bhi') && latestBhi != null && (
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Brand Health</p>
              </div>
              <p className="text-3xl font-bold">{latestBhi.toFixed(1)}</p>
              <p className="text-[12px] text-muted-foreground mt-1">BHI score (0-100)</p>
            </div>
          )}
          {sections.includes('sentiment') && latestSentiment != null && (
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Sentiment</p>
              </div>
              <p className="text-3xl font-bold">{latestSentiment.toFixed(1)}</p>
              <p className="text-[12px] text-muted-foreground mt-1">Social sentiment score</p>
            </div>
          )}
          {sections.includes('sov') && sov && (
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Radio className="h-4 w-4 text-violet-500" />
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Share of Voice</p>
              </div>
              <p className="text-3xl font-bold">{sov.social_sov}%</p>
              <p className="text-[12px] text-muted-foreground mt-1">Social SOV</p>
            </div>
          )}
        </div>

        {/* BHI trend */}
        {sections.includes('bhi') && bhiTrend.length > 1 && (
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-[13px] font-medium mb-4">Brand Health Index — 30-day trend</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={bhiTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={30} />
                <Tooltip
                  formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v, 'BHI']}
                  labelFormatter={(d) => fmtDate(String(d))}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="bhi" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sentiment trend */}
        {sections.includes('sentiment') && sentimentTrend.length > 1 && (
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-[13px] font-medium mb-4">Sentiment — 30-day trend</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={sentimentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={30} />
                <Tooltip
                  formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v, 'Score']}
                  labelFormatter={(d) => fmtDate(String(d))}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center pb-4">
          Powered by BrandPulse AI · {brand.name} brand intelligence report · Confidential
        </p>
      </main>
    </div>
  )
}
