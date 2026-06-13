'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

export interface SovData {
  brand_mentions: number
  competitor_mentions: Record<string, number>
  sov_pct: number | null
}

export function SovWidget({
  sov,
  competitors,
  onAddCompetitor,
  onRemoveCompetitor,
}: {
  sov: SovData
  competitors: { id: string; name: string }[]
  onAddCompetitor: (name: string) => Promise<void>
  onRemoveCompetitor: (id: string) => Promise<void>
}) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  async function add() {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await onAddCompetitor(newName.trim())
      setNewName('')
    } catch {
      toast.error('Failed to add competitor')
    } finally {
      setAdding(false)
    }
  }

  const total = sov.brand_mentions + Object.values(sov.competitor_mentions).reduce((a, b) => a + b, 0)
  const sovPct = total > 0 ? (sov.brand_mentions / total) * 100 : null

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Social Share of Voice</h3>
      </div>

      {/* SOV gauge */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Your brand</span>
          <span className="font-semibold text-foreground tabular-nums">
            {sovPct !== null ? `${sovPct.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: sovPct !== null ? `${sovPct}%` : '0%' }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {sov.brand_mentions.toLocaleString()} mentions of {total.toLocaleString()} total
        </p>
      </div>

      {/* Formula note */}
      {total === 0 && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
          SOV = your mentions ÷ category mentions × 100. Data populates once the mention crawl runs (Spine Layer 2).
        </p>
      )}

      {/* Competitor breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Competitors tracked</p>
        {competitors.length === 0 ? (
          <p className="text-xs text-muted-foreground">None added yet.</p>
        ) : (
          <div className="space-y-2.5">
            {competitors.map(c => {
              const count  = sov.competitor_mentions[c.name] ?? 0
              const pct    = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[140px]">{c.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {count > 0 && (
                        <span className="tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
                      )}
                      <Button
                        variant="ghost" size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveCompetitor(c.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {count > 0 && (
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-muted-foreground/40 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Add competitor */}
        <div className="flex gap-2 pt-1">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Add competitor brand…"
            className="h-7 text-xs"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          />
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={add} disabled={adding}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
