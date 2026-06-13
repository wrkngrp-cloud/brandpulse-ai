'use client'

import { useActionState, useState, useEffect, useRef, useCallback } from 'react'
import { toast }             from 'sonner'
import { Button }            from '@/components/ui/button'
import { Input }             from '@/components/ui/input'
import { Label }             from '@/components/ui/label'
import { Textarea }          from '@/components/ui/textarea'
import { Copy, RefreshCw, Link2, QrCode, MapPin, Sparkles, Loader2, Settings } from 'lucide-react'
import { estimateTraffic }   from '@/app/dashboard/ooh/actions'
import Link                  from 'next/link'

// ── Nigerian states + LGAs ────────────────────────────────────────────────────
const LGAS_BY_STATE: Record<string, string[]> = {
  'Lagos State': [
    'Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa',
    'Badagry', 'Epe', 'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye',
    'Ikeja', 'Ikorodu', 'Kosofe', 'Lagos Island', 'Lagos Mainland',
    'Mushin', 'Ojo', 'Oshodi-Isolo', 'Shomolu', 'Surulere',
  ],
  'FCT (Abuja)': [
    'Abaji', 'Bwari', 'Gwagwalada', 'Kuje', 'Kwali', 'Municipal Area Council',
  ],
  'Rivers State': [
    'Port Harcourt', 'Obio-Akpor', 'Eleme', 'Emohua', 'Etche',
    'Ikwerre', 'Khana', 'Okrika', 'Oyigbo', 'Tai',
  ],
  'Oyo State': [
    'Ibadan North', 'Ibadan North-East', 'Ibadan North-West',
    'Ibadan South-East', 'Ibadan South-West', 'Akinyele', 'Egbeda',
    'Lagelu', 'Ogbomosho North', 'Oluyole', 'Ona Ara',
  ],
  'Kano State': [
    'Kano Municipal', 'Nassarawa', 'Dala', 'Fagge', 'Gwale',
    'Kumbotso', 'Tarauni', 'Ungogo', 'Dawakin Tofa',
  ],
  'Kaduna State': [
    'Kaduna North', 'Kaduna South', 'Chikun', 'Igabi', 'Birnin Gwari', 'Zaria',
  ],
  'Enugu State': [
    'Enugu East', 'Enugu North', 'Enugu South', 'Igbo-Eze North', 'Udi', 'Nkanu West',
  ],
  'Delta State': [
    'Warri South', 'Warri North', 'Warri South-West', 'Oshimili South', 'Ethiope East', 'Uvwie',
  ],
  'Anambra State': [
    'Onitsha North', 'Onitsha South', 'Awka South', 'Awka North', 'Nnewi North', 'Idemili North',
  ],
  'Cross River State': [
    'Calabar Municipality', 'Calabar South', 'Odukpani', 'Abi',
  ],
  'Ondo State': [
    'Akure South', 'Akure North', 'Ondo East', 'Ondo West', 'Ile-Oluji',
  ],
  'Osun State': [
    'Osogbo', 'Ife Central', 'Ife East', 'Ilesa East', 'Ilesa West',
  ],
  'Ogun State': [
    'Abeokuta South', 'Abeokuta North', 'Sagamu', 'Ijebu Ode', 'Ado-Odo/Ota',
  ],
  'Edo State': [
    'Oredo', 'Ikpoba-Okha', 'Egor', 'Ovia North-East', 'Uhunmwonde',
  ],
}

const FORMAT_TYPES = [
  'Billboard', 'Unipole', 'Bridge Panel', 'Transit Shelter',
  'Digital Billboard', 'Wall Mural', 'Mall Display', 'Lamp Post Banner', 'Other',
]

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60)
}

interface MapboxFeature {
  properties: {
    full_address?: string
    name?: string
    place_formatted?: string
    context?: {
      place?:   { name?: string }
      region?:  { name?: string }
      locality?: { name?: string }
    }
  }
  geometry: { coordinates: [number, number] }
}

type FormState = { error?: string; success?: boolean; siteId?: string } | null

interface OohSiteFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  brandName:     string
  appUrl:        string
  customDomain:  string | null
  defaultValues?: Record<string, string | number | boolean | null>
}

export function OohSiteForm({ action, brandName, appUrl, customDomain, defaultValues }: OohSiteFormProps) {
  const [state, formAction, pending] = useActionState(action, null)

  const [siteName,     setSiteName]     = useState(String(defaultValues?.site_name    ?? ''))
  const [address,      setAddress]      = useState(String(defaultValues?.address      ?? ''))
  const [city,         setCity]         = useState(String(defaultValues?.city         ?? ''))
  const [stateNg,      setStateNg]      = useState(String(defaultValues?.state        ?? ''))
  const [lga,          setLga]          = useState(String(defaultValues?.lga          ?? ''))
  const [formatType,   setFormatType]   = useState(String(defaultValues?.format_type  ?? ''))
  const [landingUrl,   setLandingUrl]   = useState(String(defaultValues?.landing_url  ?? ''))
  const [slug,         setSlug]         = useState(String(defaultValues?.vanity_slug  ?? ''))
  const [qrEnabled,    setQrEnabled]    = useState(Boolean(defaultValues?.qr_token))
  const [lat,          setLat]          = useState<number | ''>(defaultValues?.lat != null ? Number(defaultValues.lat) : '')
  const [lng,          setLng]          = useState<number | ''>(defaultValues?.lng != null ? Number(defaultValues.lng) : '')
  const [dailyTraffic, setDailyTraffic] = useState<number | ''>(defaultValues?.daily_traffic != null ? Number(defaultValues.daily_traffic) : '')
  const [trafficAiEst, setTrafficAiEst] = useState(Boolean(defaultValues?.traffic_ai_estimated))
  const [estimating,   setEstimating]   = useState(false)

  // Autocomplete state
  const [suggestions,    setSuggestions]    = useState<MapboxFeature[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [geocoding,      setGeocoding]      = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef  = useRef<HTMLDivElement>(null)

  // Auto-derive slug
  useEffect(() => {
    if (!defaultValues?.vanity_slug && (siteName || city)) {
      setSlug(slugify(`${siteName}-${city}`))
    }
  }, [siteName, city, defaultValues?.vanity_slug])

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced Mapbox autocomplete
  const fetchSuggestions = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 3) { setSuggestions([]); setShowSuggestions(false); return }

    debounceRef.current = setTimeout(async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) return
      setGeocoding(true)
      try {
        const url = new URL('https://api.mapbox.com/search/geocode/v6/forward')
        url.searchParams.set('q',            query)
        url.searchParams.set('country',      'NG')
        url.searchParams.set('autocomplete', 'true')
        url.searchParams.set('limit',        '5')
        url.searchParams.set('access_token', token)
        const res  = await fetch(url.toString())
        const json = await res.json()
        setSuggestions(json?.features ?? [])
        setShowSuggestions(true)
      } catch { /* silent */ }
      finally { setGeocoding(false) }
    }, 300)
  }, [])

  function handleAddressChange(value: string) {
    setAddress(value)
    fetchSuggestions(value)
  }

  function selectSuggestion(f: MapboxFeature) {
    const [foundLng, foundLat] = f.geometry.coordinates
    const fullAddr  = f.properties.full_address ?? f.properties.place_formatted ?? f.properties.name ?? ''
    const placeCity = f.properties.context?.place?.name ?? f.properties.context?.locality?.name ?? ''
    const placeRegion = f.properties.context?.region?.name ?? ''

    setAddress(fullAddr)
    setLat(Number(foundLat.toFixed(6)))
    setLng(Number(foundLng.toFixed(6)))
    if (placeCity)   setCity(placeCity)
    if (placeRegion) setStateNg(placeRegion)
    setSuggestions([])
    setShowSuggestions(false)
  }

  async function handleEstimateTraffic() {
    if (!city) { toast.error('Fill in the city first.'); return }
    setEstimating(true)
    try {
      const result = await estimateTraffic(formatType, lga, city, stateNg, address)
      if (result) {
        setDailyTraffic(result.traffic)
        setTrafficAiEst(true)
        toast.success(`${result.traffic.toLocaleString()}/day — ${result.reasoning}`)
      } else {
        toast.error('AI estimate failed. Try again.')
      }
    } finally {
      setEstimating(false)
    }
  }

  const effectiveAppUrl = customDomain ? `https://${customDomain}` : appUrl
  const vanityLink = slug ? `${effectiveAppUrl}/go/${slug}` : ''
  const utmLink    = vanityLink && landingUrl
    ? (() => {
        try {
          const url = new URL(landingUrl)
          url.searchParams.set('utm_source',   'ooh')
          url.searchParams.set('utm_medium',   'billboard')
          url.searchParams.set('utm_campaign', slugify(brandName))
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

  // LGA list filtered by selected Nigerian state
  const lgaOptions = stateNg
    ? Object.entries(LGAS_BY_STATE).find(([k]) =>
        k.toLowerCase().includes(stateNg.toLowerCase()) ||
        stateNg.toLowerCase().includes(k.toLowerCase().split(' ')[0])
      )?.[1] ?? []
    : []

  return (
    <form action={formAction} className="space-y-6">

      {/* Domain banner */}
      <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          {customDomain
            ? <span>Links use your custom domain: <strong className="text-foreground font-mono">{customDomain}</strong></span>
            : <span>Links use the BrandPulse platform domain. Want to use your own?</span>}
        </div>
        <Link
          href="/dashboard/settings/ooh-domain"
          className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="h-3 w-3" />
          {customDomain ? 'Change' : 'Set up custom domain'}
        </Link>
      </div>

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

        {/* Address with autocomplete */}
        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <div className="relative" ref={wrapperRef}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="address" name="address"
                  placeholder="Start typing an address…"
                  value={address}
                  onChange={e => handleAddressChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  autoComplete="off"
                />
                {geocoding && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden">
                {suggestions.map((f, i) => {
                  const label = f.properties.full_address ?? f.properties.place_formatted ?? f.properties.name ?? ''
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); selectSuggestion(f) }}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-accent transition-colors flex items-start gap-2"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                        <span className="leading-snug">{label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {lat !== '' && lng !== '' && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Coordinates set: {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
            </p>
          )}
        </div>

        {/* Hidden lat/lng */}
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
            <select
              id="state" name="state"
              value={stateNg}
              onChange={e => { setStateNg(e.target.value); setLga('') }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select state…</option>
              {Object.keys(LGAS_BY_STATE).map(s => <option key={s} value={s}>{s}</option>)}
              <option value="Other">Other state</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="format_type">Format</Label>
            <select
              id="format_type" name="format_type"
              value={formatType}
              onChange={e => setFormatType(e.target.value)}
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
              disabled={lgaOptions.length === 0}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">{stateNg ? 'Select LGA…' : 'Select state first'}</option>
              {lgaOptions.map(l => <option key={l} value={l}>{l}</option>)}
              {stateNg && <option value="Other">Other</option>}
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
          <Label htmlFor="daily_traffic">Est. daily traffic exposure</Label>
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
              title="AI-estimate based on format, LGA, address, and city"
            >
              {estimating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {estimating ? 'Estimating…' : 'AI estimate'}
            </Button>
          </div>
          {trafficAiEst && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI-estimated — verify with operator if available.
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
            <Label htmlFor="monthly_cost">Monthly cost</Label>
            <Input
              id="monthly_cost" name="monthly_cost" type="number" min="0" step="0.01"
              placeholder="1500000"
              defaultValue={defaultValues?.monthly_cost != null ? String(defaultValues.monthly_cost) : ''}
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
            <Input id="campaign_start" name="campaign_start" type="date"
              defaultValue={String(defaultValues?.campaign_start ?? '')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign_end">Campaign end</Label>
            <Input id="campaign_end" name="campaign_end" type="date"
              defaultValue={String(defaultValues?.campaign_end ?? '')} />
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
          <p className="text-xs text-muted-foreground">The page visitors land on after typing or scanning the vanity link.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vanity_slug">Vanity slug</Label>
          <div className="flex gap-2">
            <Input
              id="vanity_slug" name="vanity_slug"
              placeholder="marina-lagos"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              required className="flex-1"
            />
            <Button type="button" variant="outline" size="icon" onClick={regenerateSlug}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {vanityLink && (
          <div className="rounded-lg bg-muted/50 border p-3 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Vanity Link — print this on the billboard
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
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full UTM destination</span>
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
            <p className="text-xs text-muted-foreground mt-0.5">Off by default. Enable only for formats that allow scan interaction.</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Any context about this site..."
          defaultValue={String(defaultValues?.notes ?? '')} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : defaultValues ? 'Update site' : 'Create site'}
      </Button>
    </form>
  )
}
