'use client'

import { useState, useTransition } from 'react'
import { Check, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DASHBOARD_TEMPLATES } from '@/lib/widget-catalog'

interface Props {
  onSelect: (templateId: string, widgetIds: string[]) => void
  defaultTemplateId?: string
}

export function TemplatePicker({ onSelect, defaultTemplateId }: Props) {
  const [selected, setSelected] = useState(defaultTemplateId ?? DASHBOARD_TEMPLATES[0].id)
  const [isPending, startTransition] = useTransition()

  function confirm() {
    const template = DASHBOARD_TEMPLATES.find(t => t.id === selected)
    if (!template) return
    startTransition(async () => {
      await fetch('/api/dashboard/prefs', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ template: selected, widget_ids: template.widgetIds }),
      })
      onSelect(selected, template.widgetIds)
    })
  }

  return (
    <div className="fixed inset-0 z-[9980] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] my-auto bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="p-6 border-b shrink-0">
          <h2 className="text-lg font-semibold">Set up your dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a layout that fits how you work. You can customise it any time.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto">
          {DASHBOARD_TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className={cn(
                'relative text-left rounded-xl border p-4 transition-all hover:border-foreground/40',
                selected === t.id
                  ? 'border-foreground ring-2 ring-foreground/10 bg-muted/40'
                  : 'border-border bg-background hover:bg-muted/20',
              )}
            >
              {selected === t.id && (
                <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                  <Check className="h-3 w-3 text-background" />
                </span>
              )}
              <span className="text-2xl block mb-2">{t.icon}</span>
              <span className="text-sm font-semibold block">{t.label}</span>
              <span className="text-xs text-muted-foreground mt-0.5 block leading-relaxed">{t.description}</span>
              <div className="flex flex-wrap gap-1 mt-2.5">
                {t.widgetIds.slice(0, 5).map(id => (
                  <span key={id} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {id.replace(/-/g, ' ')}
                  </span>
                ))}
                {t.widgetIds.length > 5 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{t.widgetIds.length - 5} more</span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="p-6 pt-4 border-t shrink-0">
          <Button className="w-full" size="lg" onClick={confirm} disabled={isPending}>
            {isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Setting up...</>
              : <>Get started <ArrowRight className="h-4 w-4 ml-2" /></>
            }
          </Button>
        </div>
      </div>
    </div>
  )
}
