'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { toast }             from 'sonner'
import { Button }            from '@/components/ui/button'
import { Input }             from '@/components/ui/input'
import { Label }             from '@/components/ui/label'
import { Textarea }          from '@/components/ui/textarea'
import { Copy, RefreshCw, Link2, QrCode, MapPin, Sparkles, Loader2 } from 'lucide-react'
import { estimateTraffic }   from '@/app/dashboard/ooh/actions'

const FORMAT_TYPES = [
  'Billboard', 'Unipole', 'Bridge Panel', 'Transit Shelter',
  'Digital Billboard', 'Wall Mural', 'Mall Display', 'Lamp Post Banner', 'Other',
]

// Nigerian LGAs for major OOH markets
const LGAS_BY_CITY: Record<string, string[]> = {
  Lagos: [
    'Eti-Osa (Victoria Island / Ikoyi / Lekki)',
    'Lagos Island',
    'Lagos Mainland',
    'Alimosho',
    'Ikeja',
    'Surulere',
    'Mushin',
    'Oshodi-Isolo',
    'Kosofe',
    'Shomolu',
    'Agege',
    'Ajeromi-Ifelodun',
    'Amuwo-Odofin',
    'Apapa',
    'Badagry',
    'Epe',
    'Ibeju-Lekki',
    'Ifako-Ijaiye',
    'Ikorodu',
    'Ojodu',
    'Ojota',
  ],
  Abuja: [
    'Municipal Area Council (City Centre)',
    'Abuja North',
    'Abuja South',
    'Bwari',
    'Gwagwalada',
    'Kuje',
    'Kwali',
  ],
  'Port Harcourt': [
    'Port Harcourt City',
    'Obio-Akpor',
    'Eleme',
    'Ikwerre',
    'Oyigbo',
  ],
  Kano: [
    'Kano Municipal',
    'Nassarawa',
    'Dala',
    'Fagge',
    'Gwale',
    'Tarauni',
    'Ungogo',
  ],
  Ibadan: [
    'Ibadan North',
    'Ibadan North-East',
    'Ibadan North-West',
    'Ibadan South-East',
    'Ibadan South-West',
    'Lagelu',
    'Ona Ara',
  ],
}

const ALL_LGAS = [...new Set(Object.values(LGAS_BY_CITY).flat())].sort()

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

  const [siteName,     setSiteName]     = useState(String(defaultValues?.site_name    ?? ''))
  const [address,      setAddress]      = useState(String(defaultValues?.address      ?? ''))
  const [city,         setCity]         = useState(String(defaultValues?.city         ?? ''))
  const [landingUrl,   setLandingUrl]   = useState(String(defaultValues?.landing_url  ?? ''))
  const [slug,         setSlug]         = useState(String(defaultValues?.vanity_slug  ?? ''))
  const [qrEnabled,    setQrEnabled]    = useState(Boolean(defaultValues?.qr_token))
  const [lat,          setLat]          = useState<number | ''>(defaultValues?.lat != null ? Number(defaultValues.lat) : '')
  const [lng,          setLng]          = useState<number | ''>(defaultValues?.lng != null ? Number(defaultValues.lng) : '')
  const [geocoding,    setGeocoding]    = useState(false)
  const [geocodeHint,  setGeocodeHint]  = useState('')
  const [dailyTraffic, setDailyTraffic] = useState<number | ''>(defaultValues?.daily_traffic != null ? Number(defaultValues.daily_traffic) : '')
  const [trafficAiEst, setTrafficAiEst] = useState(Boolean(defaultValues?.traffic_ai_estimated))
  const [estimating,   setEstimating]   = useState(false)
  const [lga,          setLga]          = useState(String(defaultValues?.lga ?? ''))

  const addressRef = useRef<HTMLInputElement>(null)

  // Auto-derive slug from site name + city
  useEffect(() => {
    if (!defaultValues?.vanity_slug && (siteName || city)) {
      setSlug(slugify(`${siteName}-${city}`))
    }
  }, [siteName, city, defaultValues?.vanity_slug])

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  // Mapbox forward geocoding
  async function geocodeAddress() {
    const query = address.trim() || `${siteName}, ${city}, Nigeria`
    if (!query) return

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
      toast.error('Mapbox token not configured — add NEXT_PUBLIC_MAPBOX_TOKEN')
      return
    }

    setGeocoding(true)
    setGeocodeHint('')
    try {
      const url = new URL('https://api.mapbox.com/search/geocode/v6/forward')
      url.searchParams.set('q',             query)
      url.searchParams.set('country',       'NG')
      url.searchParams.set('limit',         '1')
      url.searchParams.set('access_token',  token)

      const res  = await fetch(url.toString())
      const json = await res.json()
      const feature = json?.features?.[0]

      if (!feature) {
        setGeocodeHint('Address not found. Try adding city or state.')
        return
      }

      const [foundLng, foundLat] = feature.geometry.coordinates as [number, number]
      setLat(Number(foundLat.toFixed(6)))
      setLng(Number(foundLng.toFixed(6)))
      setGeocodeHint(`Pinned: ${feature.properties.full_address ?? feature.properties.name}`)
    } catch {
      toast.error('Geocoding failed. Check your connection.')
    } finally {
      setGeocoding(false)
    }
  }

  async function handleEstimateTraffic() {
    setEstimating(true)
    try {
      const result = await estimateTraffic(
        (document.getElementById('format_type') as HTMLSelectElement)?.value ?? '',
        lga,
        city,
      )
      if (result) {
        setDailyTraffic(result.traffic)
        setTrafficAiEst(true)
        toast.success(`AI estimate: ${result.traffic.toLocaleString()}/day — ${result.reasoning}`)
      } else {
        toast.error('Could not generate estimate. Add city and format first.')
      }
    } finally {
      setEstimating(false)
    }
  }

  const vanityLink = slug ? `${appUrl}/go/${slug}` : ''
  const utmLink = vanityLink && landingUrl
    ? (() => {
        try {
          const url      = new URL(landingUrl)
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

  // LGA list: city-specific if city matches, otherwise full list
  const lgaOptions = LGAS_BY_CITY[city] ?? ALL_LGAS

  return (
    <form action={formAction} className="space-y-6">

      {/* Section 1: Site Details */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">Site Details</h2>

        <div className="space-y-1.5">
          <Label htmlFor="site_name">Site name</Label>
          <Input
            id="site_name" name="site_name"
            placeholder="e.g. Marina Unipole"
            value={siteName}
            onChange={e => setSiteName(e.target.value)}
            required
          />
        </div>

        {/* Address with geocoding */}
        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <div className="flex gap-2">
            <Input
              id="address" name="address"
              ref={addressRef}
              placeholder="e.g. 3 Ahmed Onibudo Street, Victoria Island"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); geocodeAddress() } }}
              className="flex-1"
            />
            <Button
              type="button" variant="outline" size="sm"
              className="shrink-0 gap-1.5"
              onClick={geocodeAddress}
              disabled={geocoding}
            >
              {geocoding
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <MapPin className="h-3.5 w-3.5" />}
              {geocoding ? 'Looking up…' : 'Get coordinates'}
            </Button>
          </div>
          {geocodeHint && (
            <p className={`text-xs ${geocodeHint.startsWith('Pinned') ? 'text-green-600 dark:text-green-400' : 'text-amber-600'}`}>
              {geocodeHint}
            </p>
          )}
          {lat !== '' && lng !== '' && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Coordinates: {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
            </p>
          )}
        </div>

        {/* Hidden lat/lng — populated by geocoding */}
        <input type="hidden" name="lat" value={lat === '' ? '' : String(lat)} />
        <input type="hidden" name="lng" value={lng === '' ? '' : String(lng)} />

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
              {FORMAT_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lga">LGA</Label>
            <select
              id="lga" name="lga"
              value={lga}
              onChange={e => setLga(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select LGA…</option>
              {lgaOptions.map(l => <option key={l} value={l}>{l}</option>)}
              <option value="Other">Other</option>
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
      </div>

      {/* Section 2: Cost & Campaign */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">Cost &amp; Campaign Window</h2>

        {/* Daily traffic with AI estimate */}
        <div className="space-y-1.5">
          <Label htmlFor="daily_traffic">Est. daily traffic</Label>
          <div className="flex gap-2">
            <Input
              id="daily_traffic" name="daily_traffic" type="number" min="0"
              placeholder="50000"
              value={dailyTraffic === '' ? '' : String(dailyTraffic)}
              onChange={e => {
                setDailyTraffic(e.target.value === '' ? '' : Number(e.target.value))
                setTrafficAiEst(false)
              }}
              className="flex-1"
            />
            <Button
              type="button" variant="outline" size="sm"
              className="shrink-0 gap-1.5"
              onClick={handleEstimateTraffic}
              disabled={estimating || !city}
              title="AI-estimate based on format, LGA, and city"
            >
              {estimating
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="h-3.5 w-3.5" />}
              {estimating ? 'Estimating…' : 'AI estimate'}
            </Button>
          </div>
          {trafficAiEst && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI-estimated — verify with your media operator if available.
            </p>
          )}
          <input type="hidden" name="traffic_ai_estimated" value={String(trafficAiEst)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="operator">Operator / vendor</Label>
          <Input
            id="operator" name="operator"
            placeholder="Posterscope, LAASAA permit, etc."
            defaultValue={String(defaultValues?.operator ?? '')}
          />
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
          <p className="text-xs text-muted-foreground">
            The page visitors land on after typing or scanning the vanity link.
          </p>
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
                  <Link2 className="h-3 w-3" /> Vanity Link (print this on the billboard)
                </span>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => copyLink(vanityLink)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <p className="text-xs font-mono break-all text-foreground">{vanityLink}</p>
            </div>

            {utmLink && (
              <div className="space-y-1 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Full UTM Destination (for analytics)
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => copyLink(utmLink)}>
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
              <Label htmlFor="qr_enabled" className="text-sm cursor-pointer">Generate QR code</Label>
              <input
                type="checkbox" id="qr_enabled" name="qr_enabled"
                checked={qrEnabled}
                onChange={e => setQrEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Off by default. Enable only for formats that allow scan interaction (bus shelter, mall display).
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
