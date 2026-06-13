'use client'

import { useState, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast }    from 'sonner'
import { createEvent } from '@/app/dashboard/events/actions'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TagInput } from '@/components/onboarding/brand-profile-fields'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['Basics', 'Goals', 'KPI Targets', 'Budget', 'Team']
const EVENT_TYPES = ['Activation', 'Sponsorship', 'Pop-up', 'Roadshow', 'Exhibition', 'Concert', 'Launch', 'Other']

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
  objectives: {
    awareness:     string
    consideration: string
    action:        string
    advocacy:      string
  }
  activation_mechanics: string[]
  kpi_targets: {
    expected_engaged:         string
    expected_leads:           string
    expected_new_customers:   string
    target_cost_per_lead:     string
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
  objectives: { awareness: '', consideration: '', action: '', advocacy: '' },
  activation_mechanics: [],
  kpi_targets: {
    expected_engaged: '', expected_leads: '', expected_new_customers: '',
    target_cost_per_lead: '', target_cost_per_customer: '',
  },
  budget: '', currency: 'NGN', missed_call_number: '',
  ambassadors: [{ name: '', phone: '' }],
}

export function EventWizard() {
  const [step, setStep]   = useState(0)
  const [data, setData]   = useState<WizardData>(INIT)
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

  function setObj(key: keyof WizardData['objectives'], val: string) {
    setData(prev => ({ ...prev, objectives: { ...prev.objectives, [key]: val } }))
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
      state:               data.state.trim()    || undefined,
      date_start:          data.date_start,
      date_end:            data.date_end,
      hashtags:            data.hashtags,
      expected_attendance: data.expected_attendance ? parseInt(data.expected_attendance) : undefined,
      objectives:          {
        awareness:     data.objectives.awareness     || undefined,
        consideration: data.objectives.consideration || undefined,
        action:        data.objectives.action        || undefined,
        advocacy:      data.objectives.advocacy      || undefined,
      },
      activation_mechanics: data.activation_mechanics,
      kpi_targets: {
        expected_engaged:         data.kpi_targets.expected_engaged        ? parseInt(data.kpi_targets.expected_engaged)        : undefined,
        expected_leads:           data.kpi_targets.expected_leads          ? parseInt(data.kpi_targets.expected_leads)          : undefined,
        expected_new_customers:   data.kpi_targets.expected_new_customers  ? parseInt(data.kpi_targets.expected_new_customers)  : undefined,
        target_cost_per_lead:     data.kpi_targets.target_cost_per_lead    ? parseFloat(data.kpi_targets.target_cost_per_lead)  : undefined,
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

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={cn(
              'h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors',
              i < step  && 'bg-foreground text-background',
              i === step && 'bg-foreground text-background',
              i > step  && 'bg-muted text-muted-foreground',
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
                <Input id="name" value={data.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Kuda Surulere Activation" />
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

        {/* Step 1: Goals & Mechanics */}
        {step === 1 && (
          <>
            <h2 className="font-semibold text-sm">Goals & activation mechanics</h2>
            <p className="text-xs text-muted-foreground">What do you want this event to achieve at each stage of the funnel?</p>
            {(['awareness','consideration','action','advocacy'] as const).map(stage => (
              <div key={stage} className="space-y-2">
                <Label htmlFor={stage} className="capitalize">{stage} goal</Label>
                <Input
                  id={stage}
                  value={data.objectives[stage]}
                  onChange={e => setObj(stage, e.target.value)}
                  placeholder={
                    stage === 'awareness'     ? 'e.g. Reach 2,000 people in Surulere' :
                    stage === 'consideration' ? 'e.g. 500 brand conversations started' :
                    stage === 'action'        ? 'e.g. 200 new leads captured' :
                                               'e.g. 50 photo moments shared on social'
                  }
                />
              </div>
            ))}
            <TagInput
              label="Activation mechanics"
              placeholder="e.g. Sampling, Games, Photography"
              values={data.activation_mechanics}
              onChange={v => set('activation_mechanics', v)}
              hint="What mechanics will you use to engage people? Add each one and press Enter."
            />
          </>
        )}

        {/* Step 2: KPI Targets */}
        {step === 2 && (
          <>
            <h2 className="font-semibold text-sm">KPI targets</h2>
            <p className="text-xs text-muted-foreground">These targets appear on your ROI report. Leave blank if not applicable.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expected_engaged">Expected engaged visitors</Label>
                <Input id="expected_engaged" type="number" min={0} value={data.kpi_targets.expected_engaged} onChange={e => setKpi('expected_engaged', e.target.value)} placeholder="1000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expected_leads">Expected new leads</Label>
                <Input id="expected_leads" type="number" min={0} value={data.kpi_targets.expected_leads} onChange={e => setKpi('expected_leads', e.target.value)} placeholder="200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expected_customers">Expected new customers</Label>
                <Input id="expected_customers" type="number" min={0} value={data.kpi_targets.expected_new_customers} onChange={e => setKpi('expected_new_customers', e.target.value)} placeholder="50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpl">Target cost per lead (NGN)</Label>
                <Input id="cpl" type="number" min={0} value={data.kpi_targets.target_cost_per_lead} onChange={e => setKpi('target_cost_per_lead', e.target.value)} placeholder="2500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpa">Target cost per customer (NGN)</Label>
                <Input id="cpa" type="number" min={0} value={data.kpi_targets.target_cost_per_customer} onChange={e => setKpi('target_cost_per_customer', e.target.value)} placeholder="10000" />
              </div>
            </div>
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
