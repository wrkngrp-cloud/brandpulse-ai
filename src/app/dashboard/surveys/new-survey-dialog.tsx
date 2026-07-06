'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap, Activity, Globe, CalendarDays, BarChart2, ShoppingBag,
  ArrowLeft, Loader2, Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { createSurvey } from './actions'
import { SURVEY_TEMPLATES, type SurveyType } from '@/lib/survey-templates'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Activity, Globe, CalendarDays, BarChart2, ShoppingBag,
}

type Step = 'pick' | 'name'

export function NewSurveyDialog() {
  const router = useRouter()
  const [open,     setOpen]     = useState(false)
  const [step,     setStep]     = useState<Step>('pick')
  const [template, setTemplate] = useState<SurveyType>('b2_intercept')
  const [name,     setName]     = useState('')
  const [pending,  startTransition] = useTransition()

  function reset() {
    setStep('pick')
    setTemplate('b2_intercept')
    setName('')
  }

  function handleSelect(id: SurveyType) {
    setTemplate(id)
    setStep('name')
  }

  function handleBack() {
    setStep('pick')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      const id = await createSurvey(name.trim(), template)
      setOpen(false)
      reset()
      router.push(`/dashboard/surveys/${id}`)
    })
  }

  const selectedTemplate = SURVEY_TEMPLATES.find(t => t.id === template)

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4 mr-1.5" />
        New survey
      </DialogTrigger>

      <DialogContent className={cn('transition-all', step === 'pick' ? 'sm:max-w-2xl' : 'sm:max-w-sm')}>
        {step === 'pick' && (
          <>
            <DialogHeader>
              <DialogTitle>Choose a survey template</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-1">
              Each template has pre-written questions you can launch immediately.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {SURVEY_TEMPLATES.map(tmpl => {
                const Icon = ICON_MAP[tmpl.iconName] ?? Zap
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelect(tmpl.id)}
                    className="text-left border rounded-xl p-4 hover:border-foreground hover:bg-muted/30 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-sm font-semibold group-hover:text-foreground">{tmpl.label}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {tmpl.questionCount}Q
                          </span>
                          <span className="text-[11px] text-muted-foreground/50">·</span>
                          <span className="text-[11px] text-muted-foreground">
                            {tmpl.timeEstimate}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                          {tmpl.tagline}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 'name' && selectedTemplate && (
          <>
            <DialogHeader>
              <DialogTitle>Name your survey</DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-2 -mt-1">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Change template
              </button>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                {selectedTemplate.label} — {selectedTemplate.questionCount}Q, {selectedTemplate.timeEstimate}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="survey-name">Survey name</Label>
                <Input
                  id="survey-name"
                  placeholder={`e.g. ${
                    selectedTemplate.id === 'post_event'       ? 'June Lagos Activation — attendee survey' :
                    selectedTemplate.id === 'perception_audit' ? 'Q2 Brand Perception Audit' :
                    selectedTemplate.id === 'quick_pulse'      ? 'July Quick Pulse' :
                    selectedTemplate.id === 'awareness_check'  ? 'Awareness Check — July' :
                    selectedTemplate.id === 'post_purchase_nps'? 'Post-Purchase NPS — Ramadan promo' :
                    'June awareness pulse'
                  }`}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={!name.trim() || pending}>
                {pending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : 'Create survey'
                }
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
