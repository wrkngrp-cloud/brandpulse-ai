'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, ArrowRight, Check, Loader2, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── schema ────────────────────────────────────────────────────────────────────

// Keep budget as strings in the form; parse to numbers at submit time
// This avoids z.coerce / z.preprocess unknown-type issues with zodResolver v5 + Zod v4
const schema = z.object({
  platform:        z.enum(['meta', 'google', 'tiktok', 'linkedin', 'twitter']),
  headline:        z.string().min(3, 'Headline must be at least 3 characters').max(150),
  body:            z.string().max(500).optional(),
  cta:             z.string().optional(),
  destination_url: z.string().url('Enter a valid URL'),
  budget_daily:    z.string().optional().refine(
    v => !v || Number(v) >= 500,
    { message: 'Minimum daily budget is ₦500' }
  ),
  budget_total:    z.string().optional().refine(
    v => !v || Number(v) >= 1000,
    { message: 'Minimum total budget is ₦1,000' }
  ),
  start_date:      z.string().optional(),
  end_date:        z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ── step config ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Platform'  },
  { id: 2, label: 'Content'   },
  { id: 3, label: 'Budget'    },
  { id: 4, label: 'Review'    },
]

const PLATFORMS = [
  { value: 'meta',     label: 'Meta Ads',        description: 'Facebook & Instagram' },
  { value: 'google',   label: 'Google Ads',       description: 'Search & Display'     },
  { value: 'tiktok',   label: 'TikTok Ads',       description: 'Short-form video'     },
  { value: 'linkedin', label: 'LinkedIn Ads',     description: 'B2B audiences'        },
  { value: 'twitter',  label: 'X (Twitter) Ads',  description: 'Real-time reach'      },
] as const

const CTAS = [
  'Shop Now', 'Learn More', 'Sign Up', 'Contact Us',
  'Download', 'Get Quote', 'Book Now', 'Subscribe',
  'Watch More', 'Apply Now',
]

// ── component ─────────────────────────────────────────────────────────────────

export default function CreateAdPage() {
  const router   = useRouter()
  const [step, setStep]       = useState(1)
  const [saving, setSaving]   = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      platform:        'meta',
      headline:        '',
      body:            '',
      cta:             'Learn More',
      destination_url: '',
    },
  })

  const { register, watch, setValue, formState: { errors } } = form
  const values = watch()

  function nextStep() {
    setStep(s => Math.min(s + 1, STEPS.length))
  }

  function prevStep() {
    setStep(s => Math.max(s - 1, 1))
  }

  // Step validation guards
  async function handleNext() {
    if (step === 1) {
      const ok = await form.trigger('platform')
      if (ok) nextStep()
    } else if (step === 2) {
      const ok = await form.trigger(['headline', 'body', 'cta', 'destination_url'])
      if (ok) nextStep()
    } else if (step === 3) {
      nextStep()
    }
  }

  async function handleSubmit() {
    const valid = await form.trigger()
    if (!valid) {
      toast.error('Please fix the errors before saving.')
      return
    }

    setSaving(true)
    try {
      const payload = form.getValues()
      const res = await fetch('/api/ads/drafts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          platform:        payload.platform,
          headline:        payload.headline,
          body:            payload.body     ?? null,
          cta:             payload.cta      ?? null,
          destination_url: payload.destination_url,
          budget_daily:    payload.budget_daily ? Number(payload.budget_daily) : null,
          budget_total:    payload.budget_total ? Number(payload.budget_total) : null,
          start_date:      payload.start_date ?? null,
          end_date:        payload.end_date   ?? null,
          media_urls:      [],
          target_audience: {},
          placement:       [],
        }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to save draft')
      }

      toast.success('Ad draft saved. Review it in the Ads Drafts section.')
      router.push('/dashboard/digital')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => router.push('/dashboard/digital')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create Ad</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your ad will be saved as a draft for review before going live.
            </p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
              step > s.id
                ? 'bg-emerald-500 text-white'
                : step === s.id
                ? 'bg-indigo-500 text-white'
                : 'bg-muted text-muted-foreground'
            )}>
              {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
            </div>
            <span className={cn(
              'text-xs font-medium hidden sm:block',
              step === s.id ? 'text-foreground' : 'text-muted-foreground'
            )}>{s.label}</span>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'h-px w-8 mx-1 transition-colors',
                step > s.id ? 'bg-emerald-500' : 'bg-border'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Platform */}
      {step === 1 && (
        <Card className="border rounded-xl p-6 bg-card space-y-4">
          <h2 className="text-base font-semibold">Choose a platform</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORMS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setValue('platform', p.value)}
                className={cn(
                  'border rounded-xl p-4 text-left transition-colors',
                  values.platform === p.value
                    ? 'border-indigo-500 bg-indigo-500/5'
                    : 'border-border hover:border-indigo-300'
                )}
              >
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Step 2: Content */}
      {step === 2 && (
        <Card className="border rounded-xl p-6 bg-card space-y-5">
          <h2 className="text-base font-semibold">Ad content</h2>

          <div className="space-y-2">
            <Label htmlFor="headline">Headline <span className="text-rose-500">*</span></Label>
            <Input
              id="headline"
              placeholder="e.g. Discover the freshest produce in Lagos"
              maxLength={150}
              {...register('headline')}
            />
            {errors.headline && (
              <p className="text-xs text-rose-500">{errors.headline.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Body text</Label>
            <Textarea
              id="body"
              placeholder="Tell people what you are offering and why it matters..."
              rows={4}
              maxLength={500}
              className="resize-none"
              {...register('body')}
            />
            {errors.body && (
              <p className="text-xs text-rose-500">{errors.body.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Call to action</Label>
              <Select
                value={values.cta ?? ''}
                onValueChange={(v: string | null) => setValue('cta', v ?? undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select CTA" />
                </SelectTrigger>
                <SelectContent>
                  {CTAS.map(cta => (
                    <SelectItem key={cta} value={cta}>{cta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination_url">Destination URL <span className="text-rose-500">*</span></Label>
              <Input
                id="destination_url"
                type="url"
                placeholder="https://yourbrand.com/promo"
                {...register('destination_url')}
              />
              {errors.destination_url && (
                <p className="text-xs text-rose-500">{errors.destination_url.message}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Budget */}
      {step === 3 && (
        <Card className="border rounded-xl p-6 bg-card space-y-5">
          <h2 className="text-base font-semibold">Budget and schedule</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget_daily">Daily budget (₦)</Label>
              <Input
                id="budget_daily"
                type="number"
                min={500}
                step={100}
                placeholder="e.g. 5000"
                {...register('budget_daily')}
              />
              {errors.budget_daily && (
                <p className="text-xs text-rose-500">{errors.budget_daily.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_total">Total budget (₦)</Label>
              <Input
                id="budget_total"
                type="number"
                min={1000}
                step={1000}
                placeholder="e.g. 50000"
                {...register('budget_total')}
              />
              {errors.budget_total && (
                <p className="text-xs text-rose-500">{errors.budget_total.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                type="date"
                {...register('start_date')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                type="date"
                {...register('end_date')}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Set either a daily or total budget. You can update these before the ad goes live.
          </p>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <Card className="border rounded-xl p-6 bg-card space-y-5">
          <h2 className="text-base font-semibold">Review your ad</h2>

          <div className="space-y-3 rounded-lg bg-muted/40 p-4 text-sm">
            <ReviewRow label="Platform"   value={PLATFORMS.find(p => p.value === values.platform)?.label ?? values.platform} />
            <ReviewRow label="Headline"   value={values.headline} />
            {values.body         && <ReviewRow label="Body"        value={values.body} />}
            {values.cta          && <ReviewRow label="CTA"         value={values.cta} />}
            <ReviewRow label="URL"        value={values.destination_url} />
            {values.budget_daily && <ReviewRow label="Daily budget" value={`₦${Number(values.budget_daily).toLocaleString('en-NG')}`} />}
            {values.budget_total && <ReviewRow label="Total budget" value={`₦${Number(values.budget_total).toLocaleString('en-NG')}`} />}
            {values.start_date   && <ReviewRow label="Start"        value={values.start_date} />}
            {values.end_date     && <ReviewRow label="End"          value={values.end_date} />}
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              This draft will be saved with status <strong>Draft</strong>. It will not go live until you push it from the Ads Drafts section and a team member approves it.
            </p>
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={step === 1 ? () => router.push('/dashboard/digital') : prevStep}
          disabled={saving}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>

        {step < STEPS.length ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Save draft
              </>
            )}
          </Button>
        )}
      </div>

    </div>
  )
}

// ── sub-component ─────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="text-sm font-medium break-all">{value}</span>
    </div>
  )
}
