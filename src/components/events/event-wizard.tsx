'use client'

import { useState, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast }    from 'sonner'
import { createEvent } from '@/app/dashboard/events/actions'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TagInput } from '@/components/onboarding/brand-profile-fields'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['Basics', 'Goals', 'KPI Targets', 'Budget', 'Team']
const EVENT_TYPES = ['Activation', 'Sponsorship', 'Pop-up', 'Roadshow', 'Exhibition', 'Concert', 'Launch', 'Other']

const OBJECTIVES = [
  {
    id:    'Awareness',
    label: 'Awareness',
    desc:  'Reach and expose new audiences to the brand',
  },
  {
    id:    'Consideration',
    label: 'Consideration',
    desc:  'Drive brand conversations, samples, and trial',
  },
  {
    id:    'Action',
    label: 'Action (Leads & Sales)',
    desc:  'Capture leads, sign-ups, or new customers',
  },
  {
    id:    'Advocacy',
    label: 'Advocacy',
    desc:  'Create shareable photo moments and word-of-mouth',
  },
]

interface Ambassador { name: string; phone: string }

interface WizardData {
  name:                string
  event_type:          string
  venue:               string
  city:                string
  state:               string
  date_start:          string
  date_end:            string
  hashtags:            string[]
  expected_attendance: string
  objectives:          string[]
  activation_mechanics: string[]
  kpi_targets: {
    expected_reach:          string
    expected_engaged:        string
    expected_samples:        string
    expected_leads:          string
    expected_new_customers:  string
    expected_photo_moments:  string
    target_cost_per_lead:    string
    target_cost_per_customer: string
  }
  budget:             string
  currency:           string
  missed_call_number: string
  ambassadors:        Ambassador[]
}

const INIT: WizardData = {
  name: '', event_type: 'Activation', venue: '', city: '', state: '',
  date_start: '', date_end: '', hashtags: [], expected_attendance: '',
  objectives: [],
  activation_mechanics: [],
  kpi_targets: {
    expected_reach: '', expected_engaged: '', expected_samples: '',
    expected_leads: '', expected_new_customers: '', expected_photo_moments: '',
    target_cost_per_lead: '', target_cost_per_customer: '',
  },
  budget: '', currency: 'NGN', missed_call_number: '',
  ambassadors: [{ name: '', phone: '' }],
}

export function EventWizard({ campaignId }: { campaignId?: string | null }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>(INIT)
  const [state, action, pending] = useActionState(createEvent, null)

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  function set<K extends keyof WizardData>(key: K, val: WizardData[K]) {
    setData(prev => ({ ...prev, [key]: val }))
  }

  function setKpi(key: keyof WizardData['kpi_targets'], val: string) {
    setData(prev => ({ ...prev, kpi_targets: { ...prev.kpi_targets, [key]: val } }))
  }

  function toggleObjective(id: string) {
    setData(prev => ({
      ...prev,
      objectives: prev.objectives.includes(id)
        ? prev.objectives.filter(o => o !== id)
        : [...prev.objectives, id],
    }))
  }

  function addAmbassador() {
    setData(prev => ({ ...prev, ambassadors: [...prev.ambassadors, { name: '', phone: '' }] }))
  }

  function updateAmbassador(i: number, field: keyof Ambassador, val: string) {
    setData(prev => {
      const ambassadors = [...prev.ambassadors]
      ambassadors[i] = { ...ambassadors[i], [field]: val }
      return { ...prev, ambassadors }
    })
  }

  function removeAmbassador(i: number) {
    setData(prev => ({ ...prev, ambassadors: prev.ambassadors.filter((_, idx) => idx !== i) }))
  }

  function canProceed(): boolean {
    if (step === 0) return Boolean(data.name.trim() && data.city.trim() && data.date_start && data.date_end)
    if (step === 4) return data.ambassadors.some(a => a.name.trim())
    return true
  }

  function handleSubmit() {
    const payload = {
      name:                data.name.trim(),
      event_type:          data.event_type || undefined,
      venue:               data.venue.trim()    || undefined,
      city:                data.city.trim(),
      campaign_id:         campaignId ?? undefined,
      state:               data.state.trim()    || undefined,
      date_start:          data.date_start,
      date_end:            data.date_end,
      hashtags:            data.hashtags,
      expected_attendance: data.expected_attendance ? parseInt(data.expected_attendance) : undefined,
      objectives:          { stages: data.objectives },
      activation_mechanics: data.activation_mechanics,
      kpi_targets: {
        expected_reach:          data.kpi_targets.expected_reach          ? parseInt(data.kpi_targets.expected_reach)          : undefined,
        expected_engaged:        data.kpi_targets.expected_engaged        ? parseInt(data.kpi_targets.expected_engaged)        : undefined,
        expected_samples:        data.kpi_targets.expected_samples        ? parseInt(data.kpi_targets.expected_samples)        : undefined,
        expected_leads:          data.kpi_targets.expected_leads          ? parseInt(data.kpi_targets.expected_leads)          : undefined,
        expected_new_customers:  data.kpi_targets.expected_new_customers  ? parseInt(data.kpi_targets.expected_new_customers)  : undefined,
        expected_photo_moments:  data.kpi_targets.expected_photo_moments  ? parseInt(data.kpi_targets.expected_photo_moments)  : undefined,
        target_cost_per_lead:    data.kpi_targets.target_cost_per_lead    ? parseFloat(data.kpi_targets.target_cost_per_lead)  : undefined,
        target_cost_per_customer: data.kpi_targets.target_cost_per_customer ? parseFloat(data.kpi_targets.target_cost_per_customer) : undefined,
      },
      budget:             data.budget              ? parseFloat(data.budget) : undefined,
      currency:           data.currency,
      missed_call_number: data.missed_call_number.trim() || undefined,
      ambassadors:        data.ambassadors.filter(a => a.name.trim()),
    }

    const fd = new FormData()
    fd.set('payload', JSON.stringify(payload))
    action(fd)
  }

  // Success screen
  if (state?.success && state.eventId) {
    return (
      <div className="border rounded-xl p-12 text-center bg-card space-y-5">
        <div className="h-12 w-12 rounded-full bg-foreground/10 flex items-center justify-center mx-auto">
          <Check className="h-6 w-6 text-foreground" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Event created</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
            Your ambassador session links are ready. Head to the event to set up your team and go live when you are ready.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => router.push('/dashboard/events')}>
            <CalendarDays className="h-4 w-4 mr-1.5" />
            All events
          </Button>
          <Button onClick={() => router.push(`/dashboard/events/${state.eventId}`)}>
            Open event
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    )
  }

  // KPI visibility based on selected objectives
  const objs = new Set(data.objectives)
  const noFilter = objs.size === 0
  const showReach    = noFilter || objs.has('Awareness')
  const showEngaged  = noFilter || objs.has('Awareness') || objs.has('Consideration')
  const showSamples  = noFilter || objs.has('Consideration')
  const showLeads    = noFilter || objs.has('Action')
  const showCustomers = noFilter || objs.has('Action')
  const showCPL      = noFilter || objs.has('Action')
  const showCPA      = noFilter || objs.has('Action')
  const showPhotos   = noFilter || objs.has('Advocacy')

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={cn(
              'h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors',
              i <= step ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
            )}>
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={cn('text-xs hidden sm:block', i === step ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-4 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="border rounded-xl p-6 bg-card space-y-5">

        {/* Step 0: Basics */}
        {step === 0 && (
          <>
            <h2 className="font-semibold text-sm">Event basics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="name">Event name *</Label>
                <Input id="name" value={data.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Jara Surulere Activation" />
              </div>
              <div className="space-y-2">
                <Label>Event type</Label>
                <Select value={data.event_type} onValueChange={v => set('event_type', v ?? '')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Input id="venue" value={data.venue} onChange={e => set('venue', e.target.value)} placeholder="e.g. Bode Thomas Supermarket" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" value={data.city} onChange={e => set('city', e.target.value)} placeholder="Lagos" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={data.state} onChange={e => set('state', e.target.value)} placeholder="Lagos State" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_start">Start date *</Label>
                <Input id="date_start" type="date" value={data.date_start} onChange={e => set('date_start', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_end">End date *</Label>
                <Input id="date_end" type="date" value={data.date_end} min={data.date_start} onChange={e => set('date_end', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance">Expected attendance</Label>
                <Input id="attendance" type="number" min={1} value={data.expected_attendance} onChange={e => set('expected_attendance', e.target.value)} placeholder="500" />
              </div>
            </div>
            <TagInput
              label="Event hashtags (for social monitoring)"
              placeholder="Add hashtag and press Enter"
              values={data.hashtags}
              onChange={v => set('hashtags', v)}
              hint="These hashtags will be monitored on social media during and after the event."
            />
          </>
        )}

        {/* Step 1: Goals — objective checkbox grid */}
        {step === 1 && (
          <>
            <h2 className="font-semibold text-sm">Event objectives</h2>
            <p className="text-xs text-muted-foreground">
              What do you want this event to achieve? Select all that apply — the KPI targets in the next step will adapt.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OBJECTIVES.map(obj => {
                const selected = data.objectives.includes(obj.id)
                return (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => toggleObjective(obj.id)}
                    className={cn(
                      'text-left border rounded-xl p-4 space-y-1 transition-colors',
                      selected
                        ? 'border-foreground bg-foreground/5'
                        : 'border-border hover:border-foreground/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{obj.label}</p>
                      <div className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        selected ? 'bg-foreground border-foreground' : 'border-muted-foreground/40',
                      )}>
                        {selected && <Check className="h-2.5 w-2.5 text-background" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{obj.desc}</p>
                  </button>
                )
              })}
            </div>
            <TagInput
              label="Activation mechanics"
              placeholder="e.g. Sampling, Games, Photography"
              values={data.activation_mechanics}
              onChange={v => set('activation_mechanics', v)}
              hint="What mechanics will you use to engage people? Add each one and press Enter."
            />
          </>
        )}

        {/* Step 2: KPI Targets — adaptive per objectives */}
        {step === 2 && (
          <>
            <h2 className="font-semibold text-sm">KPI targets</h2>
            <p className="text-xs text-muted-foreground">
              {objs.size > 0
                ? `Showing targets relevant to: ${data.objectives.join(', ')}.`
                : 'Set targets for any metrics you care about. Leave blank if not applicable.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {showReach && (
                <div className="space-y-2">
                  <Label htmlFor="expected_reach">Expected reach</Label>
                  <Input id="expected_reach" type="number" min={0} value={data.kpi_targets.expected_reach} onChange={e => setKpi('expected_reach', e.target.value)} placeholder="10000" />
                </div>
              )}
              {showEngaged && (
                <div className="space-y-2">
                  <Label htmlFor="expected_engaged">Expected engaged visitors</Label>
                  <Input id="expected_engaged" type="number" min={0} value={data.kpi_targets.expected_engaged} onChange={e => setKpi('expected_engaged', e.target.value)} placeholder="1000" />
                </div>
              )}
              {showSamples && (
                <div className="space-y-2">
                  <Label htmlFor="expected_samples">Expected samples given</Label>
                  <Input id="expected_samples" type="number" min={0} value={data.kpi_targets.expected_samples} onChange={e => setKpi('expected_samples', e.target.value)} placeholder="500" />
                </div>
              )}
              {showLeads && (
                <div className="space-y-2">
                  <Label htmlFor="expected_leads">Expected new leads</Label>
                  <Input id="expected_leads" type="number" min={0} value={data.kpi_targets.expected_leads} onChange={e => setKpi('expected_leads', e.target.value)} placeholder="200" />
                </div>
              )}
              {showCustomers && (
                <div className="space-y-2">
                  <Label htmlFor="expected_customers">Expected new customers</Label>
                  <Input id="expected_customers" type="number" min={0} value={data.kpi_targets.expected_new_customers} onChange={e => setKpi('expected_new_customers', e.target.value)} placeholder="50" />
                </div>
              )}
              {showCPL && (
                <div className="space-y-2">
                  <Label htmlFor="cpl">Target cost per lead (NGN)</Label>
                  <Input id="cpl" type="number" min={0} value={data.kpi_targets.target_cost_per_lead} onChange={e => setKpi('target_cost_per_lead', e.target.value)} placeholder="2500" />
                </div>
              )}
              {showCPA && (
                <div className="space-y-2">
                  <Label htmlFor="cpa">Target cost per customer (NGN)</Label>
                  <Input id="cpa" type="number" min={0} value={data.kpi_targets.target_cost_per_customer} onChange={e => setKpi('target_cost_per_customer', e.target.value)} placeholder="10000" />
                </div>
              )}
              {showPhotos && (
                <div className="space-y-2">
                  <Label htmlFor="expected_photos">Expected photo moments</Label>
                  <Input id="expected_photos" type="number" min={0} value={data.kpi_targets.expected_photo_moments} onChange={e => setKpi('expected_photo_moments', e.target.value)} placeholder="100" />
                </div>
              )}
            </div>
            {!showReach && !showEngaged && !showSamples && !showLeads && !showCustomers && !showCPL && !showCPA && !showPhotos && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No KPI targets needed for the selected objectives. Continue to budget.
              </p>
            )}
          </>
        )}

        {/* Step 3: Budget */}
        {step === 3 && (
          <>
            <h2 className="font-semibold text-sm">Budget</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Total event budget</Label>
                <Input id="budget" type="number" min={0} value={data.budget} onChange={e => set('budget', e.target.value)} placeholder="500000" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={data.currency} onValueChange={v => set('currency', v ?? 'NGN')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN — Nigerian Naira</SelectItem>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                    <SelectItem value="GHS">GHS — Ghana Cedi</SelectItem>
                    <SelectItem value="KES">KES — Kenya Shilling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="missed_call">Missed-call opt-in number (optional)</Label>
                <Input
                  id="missed_call"
                  value={data.missed_call_number}
                  onChange={e => set('missed_call_number', e.target.value)}
                  placeholder="+2348012345678"
                />
                <p className="text-xs text-muted-foreground">Attendees flash this number with a missed call as a passive opt-in. Leave blank if not using.</p>
              </div>
            </div>
          </>
        )}

        {/* Step 4: Team */}
        {step === 4 && (
          <>
            <h2 className="font-semibold text-sm">Brand ambassadors</h2>
            <p className="text-xs text-muted-foreground">Add your field team. Each ambassador gets a private session link for the PWA.</p>
            <div className="space-y-3">
              {data.ambassadors.map((amb, i) => (
                <div key={i} className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`amb-name-${i}`} className="text-xs">Full name *</Label>
                    <Input
                      id={`amb-name-${i}`}
                      value={amb.name}
                      onChange={e => updateAmbassador(i, 'name', e.target.value)}
                      placeholder="Ambassador name"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`amb-phone-${i}`} className="text-xs">Phone</Label>
                    <Input
                      id={`amb-phone-${i}`}
                      value={amb.phone}
                      onChange={e => updateAmbassador(i, 'phone', e.target.value)}
                      placeholder="+234..."
                    />
                  </div>
                  {data.ambassadors.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeAmbassador(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addAmbassador}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add ambassador
            </Button>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed()}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed() || pending}
          >
            {pending ? 'Creating…' : 'Create event'}
            {!pending && <Check className="h-4 w-4 ml-1.5" />}
          </Button>
        )}
      </div>
    </div>
  )
}
