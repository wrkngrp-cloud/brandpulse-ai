'use client'

import { useActionState, useState, useEffect, useRef, useCallback } from 'react'
import { SuccessDialog } from '@/components/ui/success-dialog'
import { toast }              from 'sonner'
import { Button }             from '@/components/ui/button'
import { Input }              from '@/components/ui/input'
import { Label }              from '@/components/ui/label'
import { Textarea }           from '@/components/ui/textarea'
import { Copy, RefreshCw, Link2, QrCode, MapPin, Sparkles, Loader2, Settings, Zap, Map, X, Users } from 'lucide-react'
import { estimateTraffic, inferSiteDemographics } from '@/app/dashboard/ooh/actions'
import { UrlLengthAdvisor }   from '@/components/ooh/url-length-advisor'
import Link                   from 'next/link'
import type { PlaceDemographics } from '@/lib/ooh/places-demographics'

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
  'Digital Billboard', 'Wall Mural', 'Mall Display', 'Lamp Post Banner',
  'Lamppole', 'Keke Fleet', 'Wall Painting', 'Branded Vehicle', 'Other',
]

const LAMPPOLE_FORMATS = new Set(['Lamppole', 'Lamp Post Banner'])
const FLEET_FORMATS    = new Set(['Keke Fleet', 'Branded Vehicle'])
const MURAL_FORMATS    = new Set(['Wall Painting'])

const VEHICLE_TYPES = ['Truck', 'Tanker', 'Bus', 'Van']
const URBAN_CLASSES = [
  { value: 'urban',      label: 'Urban' },
  { value: 'semi_urban', label: 'Semi-urban' },
  { value: 'rural',      label: 'Rural' },
]

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60)
}

function randomShortCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

interface MapboxFeature {
  properties: {
    full_address?: string
    name?: string
    place_formatted?: string
    context?: {
      place?:    { name?: string }
      region?:   { name?: string }
      locality?: { name?: string }
    }
  }
  geometry: { coordinates: [number, number] }
}

type FormState = { error?: string; success?: boolean; siteId?: string; siteName?: string } | null

interface DraftValues {
  id: string
  site_name?: string | null
  city?: string | null
  address?: string | null
  vanity_slug?: string | null
  lat?: number | null
  lng?: number | null
  landing_url?: string | null
  format_type?: string | null
  lga?: string | null
  state?: string | null
  daily_traffic?: number | null
  monthly_cost?: number | null
  currency?: string | null
  campaign_start?: string | null
  campaign_end?: string | null
  illuminated?: boolean | null
  pole_count?: number | null
  short_code?: string | null
  notes?: string | null
  operator?: string | null
  traffic_ai_estimated?: boolean | null
}

interface OohSiteFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  brandName:    string
  appUrl:       string
  customDomain: string | null
  defaultValues?: Record<string, string | number | boolean | null>
  draft?: DraftValues | null
  campaignId?: string | null
}

export function OohSiteForm({ action, brandName, appUrl, customDomain, defaultValues, draft, campaignId }: OohSiteFormProps) {
  const [state, formAction, pending] = useActionState(action, null)

  const dv = defaultValues ?? {}
  const [siteName,     setSiteName]     = useState(String(dv.site_name    ?? draft?.site_name    ?? ''))
  const [address,      setAddress]      = useState(String(dv.address      ?? draft?.address      ?? ''))
  const [city,         setCity]         = useState(String(dv.city         ?? draft?.city         ?? ''))
  const [stateNg,      setStateNg]      = useState(String(dv.state        ?? draft?.state        ?? ''))
  const [lga,          setLga]          = useState(String(dv.lga          ?? draft?.lga          ?? ''))
  const [formatType,   setFormatType]   = useState(String(dv.format_type  ?? draft?.format_type  ?? ''))
  const [landingUrl,   setLandingUrl]   = useState(String(dv.landing_url  ?? draft?.landing_url  ?? ''))
  const [slug,         setSlug]         = useState(String(dv.vanity_slug  ?? draft?.vanity_slug  ?? ''))
  const [shortCode,    setShortCode]    = useState(
    String(dv.short_code ?? draft?.short_code ?? randomShortCode())
  )
  const [poleCount,    setPoleCount]    = useState<number>(
    dv.pole_count != null ? Number(dv.pole_count) : (draft?.pole_count ?? 1)
  )
  const [qrEnabled,    setQrEnabled]    = useState(Boolean(dv.qr_token))
  const [lat,          setLat]          = useState<number | ''>(dv.lat != null ? Number(dv.lat) : (draft?.lat != null ? Number(draft.lat) : ''))
  const [lng,          setLng]          = useState<number | ''>(dv.lng != null ? Number(dv.lng) : (draft?.lng != null ? Number(draft.lng) : ''))
  const [dailyTraffic, setDailyTraffic] = useState<number | ''>(dv.daily_traffic != null ? Number(dv.daily_traffic) : (draft?.daily_traffic != null ? Number(draft.daily_traffic) : ''))
  const [trafficAiEst, setTrafficAiEst] = useState(Boolean(dv.traffic_ai_estimated ?? draft?.traffic_ai_estimated))
  const [estimating,   setEstimating]   = useState(false)

  // Extended format fields
  const [fleetSize,          setFleetSize]          = useState<number | ''>('')
  const [routeLgas,          setRouteLgas]          = useState('')
  const [surfaceWidthM,      setSurfaceWidthM]      = useState<number | ''>('')
  const [surfaceHeightM,     setSurfaceHeightM]     = useState<number | ''>('')
  const [urbanClassification, setUrbanClassification] = useState('')
  const [vehicleType,        setVehicleType]        = useState('')

  // Demographics inference state
  const [demographics,     setDemographics]     = useState<PlaceDemographics | null>(null)
  const [inferringDemogs,  setInferringDemogs]  = useState(false)
  const demogDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Autocomplete state
  const [suggestions,    setSuggestions]    = useState<MapboxFeature[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [geocoding,      setGeocoding]      = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef  = useRef<HTMLDivElement>(null)

  // Pin-drop map state
  const [showPinMap,   setShowPinMap]   = useState(false)
  const pinMapRef      = useRef<HTMLDivElement>(null)
  const pinMapInstance = useRef<unknown>(null)
  const pinMarkerRef   = useRef<unknown>(null)

  // Draft auto-save state
  const [draftId,        setDraftId]        = useState<string | null>(draft?.id ?? null)
  const [showDraftBanner, setShowDraftBanner] = useState(Boolean(draft))
  const [draftSaving,    setDraftSaving]    = useState(false)
  const [draftSavedAt,   setDraftSavedAt]   = useState<Date | null>(null)
  const draftTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-fetch demographics when lat/lng are set
  useEffect(() => {
    if (lat === '' || lng === '') return
    if (demogDebounceRef.current) clearTimeout(demogDebounceRef.current)
    demogDebounceRef.current = setTimeout(async () => {
      setInferringDemogs(true)
      try {
        const result = await inferSiteDemographics(Number(lat), Number(lng))
        setDemographics(result)
      } catch {
        // graceful fallback — demographics are non-critical
      } finally {
        setInferringDemogs(false)
      }
    }, 800)
    return () => {
      if (demogDebounceRef.current) clearTimeout(demogDebounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  // Auto-derive slug from site name + city (only for new sites)
  useEffect(() => {
    if (!dv.vanity_slug && !draft?.vanity_slug && (siteName || city)) {
      setSlug(slugify(`${siteName}-${city}`))
    }
  }, [siteName, city, defaultValues?.vanity_slug])

  // Pin-drop map — init/destroy when toggled
  useEffect(() => {
    if (!showPinMap) {
      if (pinMapInstance.current) {
        ;(pinMapInstance.current as { remove(): void }).remove()
        pinMapInstance.current = null
        pinMarkerRef.current   = null
      }
      return
    }

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    // Wait for the div to be in the DOM
    const timer = setTimeout(async () => {
      if (!pinMapRef.current) return
      const { default: mapboxgl } = await import('mapbox-gl')
      mapboxgl.workerUrl = `https://api.mapbox.com/mapbox-gl-js/v${mapboxgl.version}/mapbox-gl-csp-worker.js`
      mapboxgl.accessToken = token

      const hasCoords = lat !== '' && lng !== ''
      const center: [number, number] = hasCoords
        ? [Number(lng), Number(lat)]
        : [3.3792, 6.5244] // Lagos default

      const map = new mapboxgl.Map({
        container: pinMapRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom: hasCoords ? 15 : 10,
      })

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
          showUserHeading: false,
        }),
        'top-right',
      )

      const marker = new mapboxgl.Marker({ color: '#2563eb', draggable: true })

      if (hasCoords) {
        marker.setLngLat([Number(lng), Number(lat)]).addTo(map)
      }

      async function reverseGeocode(clickLng: number, clickLat: number) {
        try {
          const url = new URL('https://api.mapbox.com/search/geocode/v6/reverse')
          url.searchParams.set('longitude',     String(clickLng))
          url.searchParams.set('latitude',      String(clickLat))
          url.searchParams.set('country',       'NG')
          url.searchParams.set('access_token',  token!)
          const res  = await fetch(url.toString())
          const json = await res.json()
          const f    = json?.features?.[0]
          if (f) {
            const fullAddr    = f.properties?.full_address ?? f.properties?.place_formatted ?? ''
            const placeCity   = f.properties?.context?.place?.name ?? f.properties?.context?.locality?.name ?? ''
            const placeRegion = f.properties?.context?.region?.name ?? ''
            if (fullAddr) setAddress(fullAddr)
            if (placeCity && !city)   setCity(placeCity)
            if (placeRegion && !stateNg) setStateNg(placeRegion)
          }
        } catch { /* silent */ }
      }

      map.on('click', (e) => {
        const { lng: clickLng, lat: clickLat } = e.lngLat
        const roundedLat = Number(clickLat.toFixed(6))
        const roundedLng = Number(clickLng.toFixed(6))
        setLat(roundedLat)
        setLng(roundedLng)
        marker.setLngLat([clickLng, clickLat]).addTo(map)
        reverseGeocode(clickLng, clickLat)
      })

      marker.on('dragend', () => {
        const pos = (marker as { getLngLat(): { lat: number; lng: number } }).getLngLat()
        setLat(Number(pos.lat.toFixed(6)))
        setLng(Number(pos.lng.toFixed(6)))
        reverseGeocode(pos.lng, pos.lat)
      })

      pinMapInstance.current = map
      pinMarkerRef.current   = marker
    }, 50)

    return () => {
      clearTimeout(timer)
      if (pinMapInstance.current) {
        ;(pinMapInstance.current as { remove(): void }).remove()
        pinMapInstance.current = null
        pinMarkerRef.current   = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPinMap])

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  // Auto-save draft 3s after the user stops typing (only for new sites, not edits)
  function scheduleDraftSave(formEl: HTMLFormElement | null) {
    if (defaultValues || !formEl) return // don't auto-save on edit pages
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(async () => {
      setDraftSaving(true)
      try {
        const { saveDraft } = await import('@/app/dashboard/ooh/actions')
        const result = await saveDraft(draftId, new FormData(formEl))
        if (result?.draftId && !draftId) setDraftId(result.draftId)
        if (!result?.error) setDraftSavedAt(new Date())
      } finally {
        setDraftSaving(false)
      }
    }, 3000)
  }

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
    const fullAddr    = f.properties.full_address ?? f.properties.place_formatted ?? f.properties.name ?? ''
    const placeCity   = f.properties.context?.place?.name ?? f.properties.context?.locality?.name ?? ''
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
        const poleNote = isLamppole && poleCount > 1
          ? ` × ${poleCount} poles = ${(result.traffic * poleCount).toLocaleString()} total/day`
          : ''
        toast.success(`${result.traffic.toLocaleString()}/day per pole${poleNote} — ${result.reasoning}`)
      } else {
        toast.error('AI estimate failed. Try again.')
      }
    } finally {
      setEstimating(false)
    }
  }

  const isLamppole = LAMPPOLE_FORMATS.has(formatType)
  const isFleet    = FLEET_FORMATS.has(formatType)
  const isMural    = MURAL_FORMATS.has(formatType)
  const isKeke     = formatType === 'Keke Fleet'
  const isVehicle  = formatType === 'Branded Vehicle'

  // Short domain: platform-level (bp.ng in future), falls back to app URL
  const shortBase  = process.env.NEXT_PUBLIC_SHORT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_SHORT_DOMAIN}`
    : appUrl
  const shortLink  = shortCode ? `${shortBase}/s/${shortCode}` : ''

  // Vanity link: uses brand's custom domain if set
  const effectiveAppUrl = customDomain ? `https://${customDomain}` : appUrl
  const vanityLink = slug ? `${effectiveAppUrl}/go/${slug}` : ''

  const utmLink = vanityLink && landingUrl
    ? (() => {
        try {
          const url = new URL(landingUrl)
          url.searchParams.set('utm_source',   'ooh')
          url.searchParams.set('utm_medium',   isLamppole ? 'lamppole' : 'billboard')
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

  function regenerateShortCode() {
    setShortCode(randomShortCode())
  }

  const lgaOptions = stateNg
    ? Object.entries(LGAS_BY_STATE).find(([k]) =>
        k.toLowerCase().includes(stateNg.toLowerCase()) ||
        stateNg.toLowerCase().includes(k.toLowerCase().split(' ')[0])
      )?.[1] ?? []
    : []

  return (
    <form
      action={formAction}
      className="space-y-6"
      onChange={e => scheduleDraftSave(e.currentTarget)}
    >

      {campaignId && <input type="hidden" name="campaign_id" value={campaignId} />}

      {/* Draft resume banner */}
      {showDraftBanner && draft && !defaultValues && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between gap-3 text-xs">
          <p className="text-amber-800 dark:text-amber-300">
            You have an unsaved draft: <strong>{draft.site_name || 'Untitled'}</strong>. We&apos;ve pre-filled the form for you.
          </p>
          <button
            type="button"
            className="shrink-0 text-amber-700 dark:text-amber-400 underline"
            onClick={async () => {
              const { discardDraft } = await import('@/app/dashboard/ooh/actions')
              if (draft.id) await discardDraft(draft.id)
              setShowDraftBanner(false)
              setDraftId(null)
            }}
          >
            Discard draft
          </button>
        </div>
      )}

      {/* Auto-save indicator */}
      {!defaultValues && (draftSaving || draftSavedAt) && (
        <p className="text-xs text-muted-foreground text-right">
          {draftSaving ? 'Saving draft…' : `Draft saved ${draftSavedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </p>
      )}

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
            <div className="relative">
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

          {!isFleet && (
            <div className="flex items-center justify-between mt-1.5">
              {lat !== '' && lng !== '' ? (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No coordinates yet — type an address above or pin on map.</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5 shrink-0"
                onClick={() => setShowPinMap(v => !v)}
              >
                {showPinMap ? <X className="h-3 w-3" /> : <Map className="h-3 w-3" />}
                {showPinMap ? 'Close map' : 'Pin on map'}
              </Button>
            </div>
          )}
          {isFleet && (
            <p className="text-xs text-muted-foreground mt-1.5">Fleet-based format — no fixed GPS coordinates needed.</p>
          )}

          {showPinMap && !isFleet && (
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs text-muted-foreground border-b">
                Click anywhere on the map to drop a pin, or drag the marker to adjust. The address fields will auto-fill.
              </div>
              <div ref={pinMapRef} style={{ height: '320px' }} />
            </div>
          )}
        </div>

        <input type="hidden" name="lat" value={isFleet ? '' : (lat === '' ? '' : String(lat))} />
        <input type="hidden" name="lng" value={isFleet ? '' : (lng === '' ? '' : String(lng))} />
        <input type="hidden" name="place_demographics" value={demographics ? JSON.stringify(demographics) : ''} />

        {/* Audience of Place card — inferred from Google Places */}
        {(inferringDemogs || demographics) && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Audience of Place</span>
              {inferringDemogs && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />}
            </div>
            {demographics && !inferringDemogs && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                    {demographics.primary_audience}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium capitalize">
                    {demographics.income_tier.replace('_', ' ')} income
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                    {demographics.age_skew}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium capitalize">
                    {demographics.gender_split.replace('_', ' ')}
                  </span>
                </div>
                {demographics.poi_types.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Detected nearby</p>
                    <div className="flex flex-wrap gap-1.5">
                      {demographics.poi_types.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded bg-background border text-muted-foreground capitalize">
                          {t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${Math.round(demographics.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {Math.round(demographics.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
            )}
            {inferringDemogs && (
              <p className="text-xs text-muted-foreground">Checking nearby points of interest…</p>
            )}
          </div>
        )}

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

        {/* Keke Fleet: fleet size + routes */}
        {isKeke && (
          <div className="space-y-4 rounded-lg border border-orange-200 bg-orange-50/40 dark:border-orange-900/40 dark:bg-orange-950/10 p-4">
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Keke Fleet Details</p>
            <div className="space-y-1.5">
              <Label htmlFor="fleet_size">Number of keke units</Label>
              <Input
                id="fleet_size" name="fleet_size" type="number" min="1"
                placeholder="e.g. 50"
                value={fleetSize === '' ? '' : String(fleetSize)}
                onChange={e => setFleetSize(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="route_lgas">LGAs covered (comma-separated)</Label>
              <Input
                id="route_lgas_input" name="route_lgas_input"
                placeholder="e.g. Ikeja, Surulere, Lagos Island"
                value={routeLgas}
                onChange={e => setRouteLgas(e.target.value)}
              />
              <input type="hidden" name="route_lgas" value={routeLgas} />
              <p className="text-xs text-muted-foreground">Comma-separated list of LGAs this fleet covers.</p>
            </div>
          </div>
        )}

        {/* Wall Painting: dimensions + classification */}
        {isMural && (
          <div className="space-y-4 rounded-lg border border-green-200 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/10 p-4">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">Wall Painting Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="surface_width_m">Width (metres)</Label>
                <Input
                  id="surface_width_m" name="surface_width_m" type="number" min="0" step="0.1"
                  placeholder="e.g. 6"
                  value={surfaceWidthM === '' ? '' : String(surfaceWidthM)}
                  onChange={e => setSurfaceWidthM(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="surface_height_m">Height (metres)</Label>
                <Input
                  id="surface_height_m" name="surface_height_m" type="number" min="0" step="0.1"
                  placeholder="e.g. 4"
                  value={surfaceHeightM === '' ? '' : String(surfaceHeightM)}
                  onChange={e => setSurfaceHeightM(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
            {surfaceWidthM !== '' && surfaceHeightM !== '' && (
              <p className="text-xs text-muted-foreground">
                Surface area: {(Number(surfaceWidthM) * Number(surfaceHeightM)).toFixed(1)} m²
                · Est. impressions: {(Number(surfaceWidthM) * Number(surfaceHeightM) * 150).toLocaleString()}/day
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="urban_classification">Area classification</Label>
              <select
                id="urban_classification" name="urban_classification"
                value={urbanClassification}
                onChange={e => setUrbanClassification(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select classification…</option>
                {URBAN_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Branded Vehicle: fleet size + vehicle type + routes */}
        {isVehicle && (
          <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/10 p-4">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Branded Vehicle Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fleet_size_v">Number of vehicles</Label>
                <Input
                  id="fleet_size_v" name="fleet_size" type="number" min="1"
                  placeholder="e.g. 20"
                  value={fleetSize === '' ? '' : String(fleetSize)}
                  onChange={e => setFleetSize(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicle_type">Vehicle type</Label>
                <select
                  id="vehicle_type" name="vehicle_type"
                  value={vehicleType}
                  onChange={e => setVehicleType(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select type…</option>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="route_lgas_v">LGAs covered (comma-separated)</Label>
              <Input
                id="route_lgas_v" name="route_lgas_input"
                placeholder="e.g. Ikeja, Surulere, Lagos Island"
                value={routeLgas}
                onChange={e => setRouteLgas(e.target.value)}
              />
              <input type="hidden" name="route_lgas" value={routeLgas} />
            </div>
            {fleetSize !== '' && (
              <p className="text-xs text-muted-foreground">
                Est. impressions: {(Number(fleetSize) * 2000).toLocaleString()}/day
                ({Number(fleetSize).toLocaleString()} vehicles × 2,000 per vehicle)
              </p>
            )}
          </div>
        )}

        {/* Lamppole: pole count field */}
        {isLamppole && (
          <div className="space-y-1.5">
            <Label htmlFor="pole_count">Number of poles in corridor</Label>
            <div className="flex items-center gap-3">
              <Input
                id="pole_count" name="pole_count" type="number" min="1" max="500"
                value={poleCount}
                onChange={e => setPoleCount(Math.max(1, Number(e.target.value)))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Impressions and CPM will be multiplied across all poles in the run.
              </p>
            </div>
          </div>
        )}
        {!isLamppole && <input type="hidden" name="pole_count" value="1" />}

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

        <div className="space-y-1.5">
          <Label htmlFor="daily_traffic">
            {isLamppole ? 'Est. daily traffic per pole' : 'Est. daily traffic exposure'}
          </Label>
          <div className="flex gap-2">
            <Input
              id="daily_traffic" name="daily_traffic" type="number" min="0"
              placeholder={isLamppole ? '10000' : '50000'}
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
              title="AI estimate based on format, LGA, address, and city"
            >
              {estimating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {estimating ? 'Estimating…' : 'AI estimate'}
            </Button>
          </div>
          {trafficAiEst && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {isLamppole && poleCount > 1
                ? `AI-estimated per pole. Total corridor: ~${((dailyTraffic as number) * poleCount).toLocaleString()}/day across ${poleCount} poles.`
                : 'AI-estimated — verify with operator if available.'}
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
            <Label htmlFor="monthly_cost">
              {isLamppole ? 'Monthly cost (total for all poles)' : 'Monthly cost'}
            </Label>
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

      {/* Section 3: Attribution Links */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">Attribution Links</h2>

        <div className="space-y-1.5">
          <Label htmlFor="landing_url">Landing page URL</Label>
          <Input
            id="landing_url" name="landing_url" type="url"
            placeholder="https://yourbrand.com/promo"
            value={landingUrl}
            onChange={e => setLandingUrl(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">The page visitors land on after typing or scanning the link.</p>
        </div>

        {/* Short code — for billboard print */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="short_code">Short code</Label>
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
              <Zap className="h-3 w-3" /> Print on billboard
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              id="short_code" name="short_code"
              placeholder="k3d9x"
              value={shortCode}
              onChange={e => setShortCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10))}
              className="flex-1 font-mono"
              maxLength={10}
            />
            <Button type="button" variant="outline" size="icon" onClick={regenerateShortCode} title="Regenerate">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">2–10 lowercase letters and numbers only. Short enough to type from a billboard.</p>
        </div>

        {/* Vanity slug — for QR/digital */}
        <div className="space-y-1.5">
          <Label htmlFor="vanity_slug">Vanity slug <span className="text-muted-foreground font-normal">(QR codes &amp; digital)</span></Label>
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

        {/* Link preview panel */}
        {(shortLink || vanityLink) && (
          <div className="rounded-lg bg-muted/50 border p-3 space-y-3">

            {/* Short link — hero row */}
            {shortLink && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-primary" />
                    Short link — print this on the billboard
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => copyLink(shortLink)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
                <p className="text-sm font-mono font-semibold break-all text-foreground">{shortLink}</p>
                {formatType && (
                  <UrlLengthAdvisor url={shortLink} formatType={formatType} />
                )}
              </div>
            )}

            {/* Vanity link */}
            {vanityLink && (
              <div className={`space-y-1 ${shortLink ? 'pt-2 border-t' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Vanity link — QR codes &amp; digital
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => copyLink(vanityLink)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
                <p className="text-xs font-mono break-all text-foreground">{vanityLink}</p>
              </div>
            )}

            {/* UTM destination */}
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

      {state?.success && state.siteId && (
        <SuccessDialog
          open={true}
          title={defaultValues ? 'Site updated' : 'Site created'}
          description={state.siteName ?? siteName}
          viewHref={`/dashboard/ooh/${state.siteId}`}
          viewLabel="View site"
          closeHref="/dashboard/ooh"
          closeLabel="Back to OOH"
        />
      )}
    </form>
  )
}
