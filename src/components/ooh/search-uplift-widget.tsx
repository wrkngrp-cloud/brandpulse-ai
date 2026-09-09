'use client'

import { useState }       from 'react'
import { toast }          from 'sonner'
import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Info } from 'lucide-react'
import { TrendIcon as TrendingUp, SearchIcon as Search } from '@/components/brand/icon'
import { Button }          from '@/components/ui/button'
import { Input }           from '@/components/ui/input'
import { Label }           from '@/components/ui/label'

interface UpliftRow {
  week_start:     string
  search_index:   number | null
  ooh_visits:     number
  correlation:    number | null
  interpretation: string | null
}

interface SearchUpliftWidgetProps {
  upliftRows:          UpliftRow[]
  siteName:            string
  siteId:              string
  brandId:             string
  totalTrackedVisits?: number
}

export function SearchUpliftWidget({ upliftRows, siteName, siteId, brandId, totalTrackedVisits = 0 }: SearchUpliftWidgetProps) {
  const [keyword,   setKeyword]   = useState('')
  const [loading,   setLoading]   = useState(false)

  async function requestUplift() {
    if (!keyword.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/ooh/search-uplift', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ siteId, brandId, keyword: keyword.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to fetch search uplift')
      }
      toast.success('Search uplift analysis queued — check back in a few minutes.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error requesting uplift')
    } finally {
      setLoading(false)
    }
  }

  const chartData = upliftRows.map(r => ({
    week: new Date(r.week_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }),
    'Search index':  r.search_index ?? 0,
    'OOH visits':    r.ooh_visits,
  }))

  const latestCorr = upliftRows.at(-1)?.correlation
  const latestInterp = upliftRows.at(-1)?.interpretation

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Branded Search Uplift</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Correlates weekly OOH visit volume with Google Trends branded search interest.
        A positive correlation suggests the billboard is driving search intent.
      </p>

      {upliftRows.length === 0 ? (
        <div className="space-y-3">
          {totalTrackedVisits === 0 && (
            <div className="rounded-lg border border-line bg-shell dark:border-line dark:bg-shell/20 p-3 flex items-start gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-tx-2 dark:text-tx-2 mt-0.5 shrink-0" />
              <p className="text-xs text-tx-2 dark:text-tx-2">
                No visits tracked yet. Make sure your attribution link is live and being used — once visits come in, the uplift analysis will have data to work with.
              </p>
            </div>
          )}
          {totalTrackedVisits > 0 && totalTrackedVisits < 7 && (
            <div className="rounded-lg border bg-muted/30 p-3 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {totalTrackedVisits} visit{totalTrackedVisits > 1 ? 's' : ''} tracked so far. The analysis works best with at least 2 weeks of data.
              </p>
            </div>
          )}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Enter the branded keyword your audience would search for after seeing this billboard (e.g. &quot;Sweetness Studios&quot; or &quot;#SweetnessOOH&quot;).
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="uplift-keyword" className="sr-only">Keyword</Label>
                <Input
                  id="uplift-keyword"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="Brand name or hashtag…"
                  className="h-8 text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); requestUplift() } }}
                />
              </div>
              <Button
                size="sm" variant="outline" className="h-8 shrink-0"
                onClick={requestUplift} disabled={loading || !keyword.trim() || totalTrackedVisits === 0}
              >
                {loading ? 'Queuing…' : 'Run analysis'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {latestCorr != null && (
            <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${
              latestCorr >= 0.5 ? 'bg-shell text-pos dark:bg-shell/30 dark:text-pos'
              : latestCorr >= 0 ? 'bg-shell text-tx-2 dark:bg-shell/30 dark:text-tx-2'
              : 'bg-flare-wash text-tx-flare dark:bg-shell/30 dark:text-tx-flare'
            }`}>
              <strong className="bg-num">r = {latestCorr.toFixed(2)}</strong>
              {latestInterp && <span className="ml-1">{latestInterp}</span>}
            </div>
          )}

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="currentColor" className="text-border opacity-35" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font)' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font)' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-ink)',
                    border: 'var(--line)',
                    borderRadius: 'var(--r-card)',
                    fontSize: 11,
                    color: 'var(--bg-card)',
                  }}
                  labelStyle={{ color: 'var(--tx-inv-2)', fontSize: 10, textTransform: '', letterSpacing: '0.10em' }}
                  cursor={{ fill: 'currentColor', opacity: 0.05 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  yAxisId="right" dataKey="OOH visits"
                  fill="var(--flare)"
                  fillOpacity={0.22}
                  radius={[4,4,0,0]}
                />
                <Line
                  yAxisId="left" type="monotone"
                  dataKey="Search index"
                  stroke="var(--ember)"
                  strokeWidth={2.5} dot={false}
                  activeDot={{ r: 4, fill: 'var(--ember)', strokeWidth: 2, stroke: 'var(--bg-card)' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-2">
            <Input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Update keyword…"
              className="h-8 text-sm"
            />
            <Button
              size="sm" variant="outline" className="h-8 shrink-0"
              onClick={requestUplift} disabled={loading || !keyword.trim()}
            >
              {loading ? 'Queuing…' : 'Refresh'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
