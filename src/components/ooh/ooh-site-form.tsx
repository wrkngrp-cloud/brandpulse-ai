'use client'

import { useActionState, useState, useEffect } from 'react'
import { toast }           from 'sonner'
import { Button }          from '@/components/ui/button'
import { Input }           from '@/components/ui/input'
import { Label }           from '@/components/ui/label'
import { Textarea }        from '@/components/ui/textarea'
import { Copy, RefreshCw, Link2, QrCode } from 'lucide-react'
import { cn }              from '@/lib/utils'

const FORMAT_TYPES = [
  'Billboard', 'Transit Shelter', 'Digital Billboard',
  'Bridge Panel', 'Unipole', 'Wall Mural', 'Mall Display', 'Other',
]

const CULTURAL_ZONES = [
  'Lagos Island', 'Lagos Mainland', 'Abuja', 'Port Harcourt',
  'Kano', 'Ibadan', 'Enugu', 'Other',
]

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

type FormState = { error?: string; success?: boolean; siteId?: string } | null

interface OohSiteFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  brandName: string
  appUrl: string
  defaultValues?: Record<string, string | number | boolean | null>
}

export function OohSiteForm({ action, brandName, appUrl, defaultValues }: OohSiteFormProps) {
  const [state, formAction, pending] = useActionState(action, null)
  const [siteName,   setSiteName]   = useState(String(defaultValues?.site_name   ?? ''))
  const [city,       setCity]       = useState(String(defaultValues?.city        ?? ''))
  const [landingUrl, setLandingUrl] = useState(String(defaultValues?.landing_url ?? ''))
  const [slug,       setSlug]       = useState(String(defaultValues?.vanity_slug ?? ''))
  const [qrEnabled,  setQrEnabled]  = useState(Boolean(defaultValues?.qr_token))

  // Auto-derive slug from site name + city
  useEffect(() => {
    if (!defaultValues?.vanity_slug && (siteName || city)) {
      setSlug(slugify(`${siteName}-${city}`))
    }
  }, [siteName, city, defaultValues?.vanity_slug])

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  const vanityLink = slug ? `${appUrl}/go/${slug}` : ''
  const utmLink = vanityLink && landingUrl
    ? (() => {
        try {
          const url = new URL(landingUrl)
          const brandSlug = slugify(brandName)
          url.searchParams.set('utm_source',   'ooh')
          url.searchParams.set('utm_medium',   'billboard')
          url.searchParams.set('utm_campaign', brandSlug)
          url.searchParams.set('utm_content',  slug)
          return url.toString()
        } catch { return '' }
      })()
    : ''

  function copyLink(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'))
  }

  function regenerateSlug() {
    const base   = slugify(`${siteName}-${city}`)
    const suffix = Math.random().toString(36).slice(2, 6)
    setSlug(base ? `${base}-${suffix}` : suffix)
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Section 1: Site Details */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">Site Details</h2>

        <div className="space-y-1.5">
          <Label htmlFor="site_name">Site name</Label>
          <Input
            id="site_name" name="site_name"
            placeholder="e.g. Marina Unipole Billboard"
            value={siteName}
            onChange={e => setSiteName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input
              id="city" name="city"
              placeholder="Lagos"
              value={city}
              onChange={e => setCity(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input
              id="state" name="state"
              placeholder="Lagos State"
              defaultValue={String(defaultValues?.state ?? '')}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="format_type">Format</Label>
            <select
              id="format_type" name="format_type"
              defaultValue={String(defaultValues?.format_type ?? '')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select format…</option>
              {FORMAT_TYPES.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cultural_zone">Cultural zone</Label>
            <select
              id="cultural_zone" name="cultural_zone"
              defaultValue={String(defaultValues?.cultural_zone ?? '')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select zone…</option>
              {CULTURAL_ZONES.map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox" id="illuminated" name="illuminated"
            defaultChecked={Boolean(defaultValues?.illuminated)}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="illuminated" className="cursor-pointer">Illuminated / backlit</Label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat" name="lat" type="number" step="0.000001"
              placeholder="6.4541"
              defaultValue={defaultValues?.lat != null ? String(defaultValues.lat) : ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng" name="lng" type="number" step="0.000001"
              placeholder="3.3947"
              defaultValue={defaultValues?.lng != null ? String(defaultValues.lng) : ''}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Cost & Campaign */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">Cost &amp; Campaign Window</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="daily_traffic">Est. daily traffic</Label>
            <Input
              id="daily_traffic" name="daily_traffic" type="number" min="0"
              placeholder="50000"
              defaultValue={defaultValues?.daily_traffic != null ? String(defaultValues.daily_traffic) : ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="operator">Operator / vendor</Label>
            <Input
              id="operator" name="operator"
              placeholder="Posterscope, etc."
              defaultValue={String(defaultValues?.operator ?? '')}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="weekly_cost">Weekly cost</Label>
            <Input
              id="weekly_cost" name="weekly_cost" type="number" min="0" step="0.01"
              placeholder="250000"
              defaultValue={defaultValues?.weekly_cost != null ? String(defaultValues.weekly_cost) : ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency" name="currency" maxLength={3}
              placeholder="NGN"
              defaultValue={String(defaultValues?.currency ?? 'NGN')}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign_start">Campaign start</Label>
            <Input
              id="campaign_start" name="campaign_start" type="date"
              defaultValue={String(defaultValues?.campaign_start ?? '')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign_end">Campaign end</Label>
            <Input
              id="campaign_end" name="campaign_end" type="date"
              defaultValue={String(defaultValues?.campaign_end ?? '')}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Attribution Link */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">Attribution Link</h2>

        <div className="space-y-1.5">
          <Label htmlFor="landing_url">Landing page URL</Label>
          <Input
            id="landing_url" name="landing_url" type="url"
            placeholder="https://yourbrand.com/promo"
            value={landingUrl}
            onChange={e => setLandingUrl(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">The page visitors land on after scanning/typing the vanity link.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vanity_slug">Vanity slug</Label>
          <div className="flex gap-2">
            <Input
              id="vanity_slug" name="vanity_slug"
              placeholder="marina-lagos"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              required
              className="flex-1"
            />
            <Button type="button" variant="outline" size="icon" onClick={regenerateSlug} title="Regenerate slug">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {vanityLink && (
          <div className="rounded-lg bg-muted/50 border p-3 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Vanity Link
                </span>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => copyLink(vanityLink)}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <p className="text-xs font-mono break-all text-foreground">{vanityLink}</p>
            </div>

            {utmLink && (
              <div className="space-y-1 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    UTM Destination
                  </span>
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => copyLink(utmLink)}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
                <p className="text-xs font-mono break-all text-muted-foreground">{utmLink}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
          <QrCode className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="qr_enabled" className="text-sm cursor-pointer">
                Generate QR code
              </Label>
              <input
                type="checkbox" id="qr_enabled" name="qr_enabled"
                checked={qrEnabled}
                onChange={e => setQrEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Off by default. Enable only if the format allows scan interaction (e.g. bus shelter, mall display).
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes" name="notes" rows={2}
          placeholder="Any context about this site..."
          defaultValue={String(defaultValues?.notes ?? '')}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : defaultValues ? 'Update site' : 'Create site'}
      </Button>
    </form>
  )
}
