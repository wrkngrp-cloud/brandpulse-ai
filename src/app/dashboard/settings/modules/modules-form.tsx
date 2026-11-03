'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CheckIcon as Check } from '@/components/brand/icon'
import { Working as Loader2 } from '@/components/brand/working'
import { cn } from '@/lib/utils'
import { GOALS, type GoalId } from '@/lib/goals'
import { saveModuleFocus } from '../actions'

export function ModulesForm({ brandName, initialGoals, initialShowAll, ready }: {
  brandName:      string
  initialGoals:   GoalId[]
  initialShowAll: boolean
  ready:          boolean
}) {
  const router = useRouter()
  const [goals, setGoals] = useState<GoalId[]>(initialGoals)
  const [showAll, setShowAll] = useState(initialShowAll)
  const [pending, start] = useTransition()

  const toggle = (id: GoalId) => setGoals(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id])
  const changed = showAll !== initialShowAll || goals.slice().sort().join() !== initialGoals.slice().sort().join()

  function save() {
    start(async () => {
      const res = await saveModuleFocus({ goals, showAll })
      if (res?.error) { toast.error(res.error); return }
      toast.success(showAll ? 'Every module is in your sidebar.' : 'Your sidebar now shows what you picked.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6" data-tour="settings-modules">
      <div className="space-y-1">
        <h2 className="text-base font-medium">Modules</h2>
        <p className="text-sm text-muted-foreground">
          Choose what {brandName} uses BrandGauge for, and the sidebar shows just those modules. Nothing is locked: you can open everything else here, any time.
        </p>
      </div>

      {!ready && (
        <p className="rounded-sm border border-line bg-shell px-3 py-2 text-sm text-tx-2">
          This setting is not switched on for your account yet, so every module is showing. Check back soon.
        </p>
      )}

      <button
        type="button"
        aria-pressed={showAll}
        onClick={() => setShowAll(v => !v)}
        className={cn(
          'w-full text-left rounded-sm border p-4 transition-colors duration-150 bg-card bg-press',
          showAll ? 'border-foreground ring-2 ring-foreground/10' : 'border-border hover:border-foreground/40',
        )}
      >
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[13px] font-semibold">Show every module</span>
            <span className="block text-[12px] text-muted-foreground mt-0.5">The full BrandGauge, all of it in the sidebar.</span>
          </span>
          <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', showAll ? 'bg-foreground border-foreground' : 'border-border')}>
            {showAll && <Check className="h-3 w-3 text-background" />}
          </span>
        </span>
      </button>

      <div className={cn('space-y-3', showAll && 'opacity-60')}>
        <p className="text-sm font-medium">Or show only what you need for</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GOALS.map(goal => {
            const selected = goals.includes(goal.id)
            return (
              <button
                key={goal.id}
                type="button"
                aria-pressed={selected}
                onClick={() => { toggle(goal.id); setShowAll(false) }}
                className={cn(
                  'relative text-left rounded-sm border p-4 transition-colors duration-150 bg-card bg-press',
                  selected && !showAll ? 'border-foreground ring-2 ring-foreground/10' : 'border-border hover:border-foreground/40',
                )}
              >
                {selected && (
                  <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground">
                    <Check className="h-2.5 w-2.5 text-background" />
                  </span>
                )}
                <span className="block text-[13px] font-semibold leading-snug pr-6">{goal.label}</span>
                <span className="block text-[11px] text-muted-foreground leading-snug mt-1">{goal.line}</span>
              </button>
            )
          })}
        </div>
      </div>

      <Button onClick={save} disabled={pending || !changed || (!showAll && goals.length === 0)}>
        {pending ? <><Loader2 className="h-4 w-4 mr-2" /> Saving...</> : 'Save'}
      </Button>
      {!showAll && goals.length === 0 && (
        <p className="text-xs text-muted-foreground">Pick at least one, or show every module.</p>
      )}
    </div>
  )
}
