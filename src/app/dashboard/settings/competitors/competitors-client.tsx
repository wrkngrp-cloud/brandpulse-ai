'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2, Building } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { toast }  from 'sonner'
import { cn }     from '@/lib/utils'

interface Competitor { id: string; name: string; created_at: string }

interface Props {
  brandId:              string
  initialCompetitors:   Competitor[]
}

export function CompetitorsClient({ initialCompetitors }: Props) {
  const [competitors, setCompetitors] = useState<Competitor[]>(initialCompetitors)
  const [newName,     setNewName]     = useState('')
  const [isPending,   startTransition] = useTransition()
  const [deletingId,  setDeletingId]  = useState<string | null>(null)

  function handleAdd() {
    const name = newName.trim()
    if (!name) { toast.error('Enter a competitor name.'); return }
    if (competitors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('This competitor is already tracked.')
      return
    }

    startTransition(async () => {
      const res = await fetch('/api/brand/competitors', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name }),
      })
      const data = await res.json() as { id: string; name: string } | { error: string }
      if ('error' in data) { toast.error(data.error); return }
      setCompetitors(prev => [...prev, { ...data, created_at: new Date().toISOString() }])
      setNewName('')
      toast.success(`${name} added to tracked competitors.`)
    })
  }

  function handleDelete(competitor: Competitor) {
    setDeletingId(competitor.id)
    startTransition(async () => {
      const res = await fetch('/api/brand/competitors', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: competitor.id }),
      })
      const data = await res.json() as { ok: boolean } | { error: string }
      setDeletingId(null)
      if ('error' in data) { toast.error(data.error); return }
      setCompetitors(prev => prev.filter(c => c.id !== competitor.id))
      toast.success(`${competitor.name} removed.`)
    })
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isPending && handleAdd()}
          placeholder="Competitor brand name (e.g. Pepsi, Airtel, PalmPay)"
          className="max-w-sm"
          disabled={isPending}
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={isPending || !newName.trim()}
        >
          {isPending && !deletingId
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <><Plus className="h-3.5 w-3.5 mr-1" />Add</>
          }
        </Button>
      </div>

      {/* List */}
      {competitors.length === 0 ? (
        <div className="border rounded-xl p-10 text-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Building className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No competitors tracked yet</p>
          <p className="text-xs text-muted-foreground">
            Add your main competitors above to start getting weekly briefings and SOV comparisons.
          </p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          {competitors.map((c, i) => (
            <div
              key={c.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 bg-card',
                i < competitors.length - 1 && 'border-b',
              )}
            >
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground uppercase">
                {c.name.charAt(0)}
              </div>
              <span className="flex-1 text-sm font-medium">{c.name}</span>
              <button
                onClick={() => handleDelete(c)}
                disabled={isPending}
                className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                aria-label={`Remove ${c.name}`}
              >
                {deletingId === c.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
