'use client'

import { useActionState, useState, useRef } from 'react'
import { Button }         from '@/components/ui/button'
import { Input }          from '@/components/ui/input'
import { Label }          from '@/components/ui/label'
import { Textarea }       from '@/components/ui/textarea'
import { SuccessDialog }  from '@/components/ui/success-dialog'
import { cn }             from '@/lib/utils'
import { ChevronRight, ChevronLeft, Lock, Check } from 'lucide-react'
import type { CampaignFormState } from '@/app/dashboard/campaigns/actions'

const OBJECTIVES = [
  { value: 'awareness',     label: 'Brand Awareness',    desc: 'Reach new audiences and build recognition' },
  { value: 'consideration', label: 'Consideration',      desc: 'Drive research and evaluation of your brand' },
  { value: 'conversion',    label: 'Conversion',         desc: 'Generate leads, sales, or sign-ups' },
  { value: 'retention',     label: 'Retention',          desc: 'Strengthen loyalty and repeat engagement' },
]

const CHANNELS = [
  { value: 'ooh',         label: 'OOH / Outdoor',       built: true },
  { value: 'events',      label: 'Events & Activations', built: true },
  { value: 'digital',     label: 'Digital',              built: true },
  { value: 'influencers', label: 'Influencers',          built: true },
  { value: 'radio',       label: 'Radio',                built: true },
  { value: 'tv',          label: 'TV',                   built: true },
  { value: 'print',       label: 'Print',                built: true },
]

interface ChannelConfig {
  budget: string
  objectives: string[]
}

interface CampaignFormProps {
  action: (prev: CampaignFormState, formData: FormData) => Promise<CampaignFormState>
}

export function CampaignForm({ action }: CampaignFormProps) {
  const [state, dispatch, pending] = useActionState(action, null)
  const [step, setStep]               = useState<1 | 2>(1)
  const [objectives, setObjectives]   = useState<string[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [channelConfig, setChannelConfig]       = useState<Record<string, ChannelConfig>>({})
  const formRef = useRef<HTMLFormElement>(null)

  function toggleObjective(val: string) {
    setObjectives(prev => prev.includes(val) ? prev.filter(o => o !== val) : [...prev, val])
  }

  function toggleChannel(ch: string) {
    setSelectedChannels(prev => {
      const next = prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
      // Remove config for deselected channel
      if (prev.includes(ch)) {
        setChannelConfig(cfg => { const c = { ...cfg }; delete c[ch]; return c })
      }
      return next
    })
  }

  function toggleChannelObjective(ch: string, obj: string) {
    setChannelConfig(prev => {
      const current = prev[ch]?.objectives ?? []
      const next    = current.includes(obj) ? current.filter(o => o !== obj) : [...current, obj]
      return { ...prev, [ch]: { ...prev[ch], budget: prev[ch]?.budget ?? '', objectives: next } }
    })
  }

  function setChannelBudget(ch: string, val: string) {
    setChannelConfig(prev => ({
      ...prev,
      [ch]: { ...prev[ch], budget: val, objectives: prev[ch]?.objectives ?? [] },
    }))
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    const name = (formRef.current?.elements.namedItem('name') as HTMLInputElement)?.value.trim()
    if (!name) return
    setStep(2)
  }

  const totalAllocated = selectedChannels.reduce(
    (s, ch) => s + (Number(channelConfig[ch]?.budget) || 0), 0
  )

  const channelConfigJson = JSON.stringify(
    Object.fromEntries(
      selectedChannels.map(ch => [ch, {
        budget:     Number(channelConfig[ch]?.budget) || null,
        objectives: channelConfig[ch]?.objectives ?? [],
      }])
    )
  )

  return (
    <>
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
        <span className={cn('font-medium', step === 1 && 'text-foreground')}>1. Campaign Brief</span>
        <ChevronRight className="h-3 w-3" />
        <span className={cn('font-medium', step === 2 && 'text-foreground')}>2. Channels &amp; Budget</span>
      </div>

      <form ref={formRef} action={dispatch} className="space-y-5">
        {/* Hidden aggregated inputs */}
        {objectives.map(o => <input key={o} type="hidden" name="objectives" value={o} />)}
        {selectedChannels.map(ch => <input key={ch} type="hidden" name="channels" value={ch} />)}
        <input type="hidden" name="channel_config" value={channelConfigJson} />

        {/* ── Step 1: Campaign Brief ── */}
        <div className={step === 1 ? 'space-y-5' : 'hidden'}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Campaign name</Label>
            <Input id="name" name="name" placeholder="e.g. Q3 Awareness Push" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description" name="description" rows={2} className="resize-none"
              placeholder="What is this campaign trying to achieve?"
            />
          </div>

          {/* Multi-select objectives */}
          <div className="space-y-2">
            <Label>Campaign objectives <span className="text-muted-foreground font-normal text-xs">(select all that apply)</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {OBJECTIVES.map(o => {
                const selected = objectives.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleObjective(o.value)}
                    className={cn(
                      'text-left border rounded-xl p-3 transition-colors relative',
                      selected ? 'border-foreground bg-muted' : 'hover:bg-muted/50',
                    )}
                  >
                    {selected && (
                      <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-foreground flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-background" />
                      </span>
                    )}
                    <p className="text-sm font-medium pr-5">{o.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">
                End date <span className="text-muted-foreground font-normal text-xs">(blank = Always On)</span>
              </Label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="total_budget">Total budget</Label>
              <Input id="total_budget" name="total_budget" type="number" min="0" step="1000" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="NGN" maxLength={3} className="uppercase" />
            </div>
          </div>

          <Button type="button" onClick={handleNext} className="w-full">
            Next: Channels &amp; Budget
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* ── Step 2: Channels & Budget ── */}
        <div className={step === 2 ? 'space-y-5' : 'hidden'}>
          <div className="space-y-2">
            <Label>Select channels</Label>
            <p className="text-xs text-muted-foreground">
              For each channel, allocate a budget and link the objectives it serves — this enables per-channel attribution in reports.
            </p>
            <div className="space-y-2 mt-3">
              {CHANNELS.map(ch => {
                const isSelected = selectedChannels.includes(ch.value)
                const cfg        = channelConfig[ch.value]

                return (
                  <div
                    key={ch.value}
                    className={cn(
                      'border rounded-xl p-3 transition-colors',
                      !ch.built && 'opacity-50 cursor-not-allowed',
                      ch.built && isSelected  && 'border-foreground bg-muted/30',
                      ch.built && !isSelected && 'hover:bg-muted/50 cursor-pointer',
                    )}
                    onClick={() => ch.built && toggleChannel(ch.value)}
                  >
                    {/* Channel header row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                          isSelected ? 'bg-foreground border-foreground' : 'border-muted-foreground',
                          !ch.built && 'border-muted',
                        )}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />}
                        </div>
                        <span className="text-sm font-medium">{ch.label}</span>
                      </div>
                      {!ch.built && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" /> Coming soon
                        </span>
                      )}
                    </div>

                    {/* Expanded config: budget + objectives */}
                    {ch.built && isSelected && (
                      <div className="mt-3 space-y-3 border-t pt-3" onClick={e => e.stopPropagation()}>
                        {/* Budget */}
                        <div className="flex items-center gap-3">
                          <Label className="text-xs text-muted-foreground shrink-0 w-28">Budget allocation</Label>
                          <Input
                            type="number" min="0" step="1000" placeholder="0"
                            value={cfg?.budget ?? ''}
                            onChange={e => setChannelBudget(ch.value, e.target.value)}
                            className="h-7 text-sm"
                          />
                        </div>

                        {/* Objective links */}
                        {objectives.length > 0 && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                              This channel contributes to
                            </Label>
                            <div className="flex flex-wrap gap-1.5">
                              {OBJECTIVES.filter(o => objectives.includes(o.value)).map(o => {
                                const linked = cfg?.objectives?.includes(o.value)
                                return (
                                  <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => toggleChannelObjective(ch.value, o.value)}
                                    className={cn(
                                      'text-xs px-2.5 py-1 rounded-full border transition-colors',
                                      linked
                                        ? 'bg-foreground text-background border-foreground'
                                        : 'border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground',
                                    )}
                                  >
                                    {o.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Budget summary */}
          {selectedChannels.length > 0 && totalAllocated > 0 && (
            <div className="border rounded-xl p-3 bg-muted/30 text-sm flex justify-between">
              <span className="text-muted-foreground">Total allocated</span>
              <span className="font-medium tabular-nums">NGN {totalAllocated.toLocaleString('en-NG')}</span>
            </div>
          )}

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? 'Creating…' : 'Create campaign'}
            </Button>
          </div>
        </div>
      </form>

      <SuccessDialog
        open={!!(state?.success && state.campaignId)}
        title="Campaign created"
        description={state?.campaignName ? `"${state.campaignName}" is ready. Add OOH sites or events to it.` : undefined}
        viewHref={state?.campaignId ? `/dashboard/campaigns/${state.campaignId}` : '/dashboard/campaigns'}
        viewLabel="View campaign"
        closeHref="/dashboard/campaigns"
        closeLabel="All campaigns"
      />
    </>
  )
}
