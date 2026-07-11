'use client'

import { useState }   from 'react'
import { Card }       from '@/components/ui/card'
import { Badge }      from '@/components/ui/badge'
import { Button }     from '@/components/ui/button'
import { Input }      from '@/components/ui/input'
import { Label }      from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator }  from '@/components/ui/separator'
import { cn }         from '@/lib/utils'
import {
  MapPin, TrendingUp, Target, Zap, Globe, Smartphone,
  Monitor, ExternalLink, Plus, ChevronRight, Radio,
  AlertCircle, CheckCircle2, Clock, Users,
} from 'lucide-react'
import { toast } from 'sonner'

interface GeoVisit {
  id:                    string
  visited_at:            string
  device_type:           string | null
  geo_city:              string | null
  geo_state:             string | null
  attribution_method:    string | null
  attribution_confidence: number | null
}

interface GeoAudience {
  id:              string
  audience_name:   string
  platform:        string
  fence_radius_m:  number
  status:          string
  estimated_reach: number | null
  creative_headline: string | null
  synced_at:       string | null
}

interface Props {
  siteId:       string
  siteName:     string
  siteLat:      number | null
  siteLng:      number | null
  siteCity:     string | null
  brandId:      string
  geoVisits:    GeoVisit[]
  audiences:    GeoAudience[]
}

const METHOD_LABELS: Record<string, string> = {
  branded_link:   'Branded Link',
  geo_proximity:  'Geo Proximity',
  direct:         'Direct',
}

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.85 ? 'text-emerald-600' : c >= 0.65 ? 'text-amber-600' : 'text-slate-500'

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:    { label: 'Draft',    color: 'bg-slate-100 text-slate-600',   icon: Clock },
  syncing:  { label: 'Syncing',  color: 'bg-blue-100 text-blue-600',     icon: Zap },
  active:   { label: 'Active',   color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  paused:   { label: 'Paused',   color: 'bg-amber-100 text-amber-700',   icon: AlertCircle },
  error:    { label: 'Error',    color: 'bg-red-100 text-red-700',       icon: AlertCircle },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
}

// Haversine distance in metres
function distM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function GeoAttributionPanel({
  siteId, siteName, siteLat, siteLng, siteCity, brandId, geoVisits, audiences,
}: Props) {
  const [showNewAudience, setShowNewAudience] = useState(false)
  const [platform,        setPlatform]        = useState('meta')
  const [radius,          setRadius]          = useState('500')
  const [audienceName,    setAudienceName]    = useState(`${siteName} — Geo Retarget`)
  const [headline,        setHeadline]        = useState('')
  const [saving,          setSaving]          = useState(false)
  const [syncing,         setSyncing]         = useState<string | null>(null)
  const [localAudiences,  setLocalAudiences]  = useState(audiences)

  // Geo-attributed visits (has geo coords)
  const geoLocated = geoVisits.filter(v => v.geo_city || v.geo_state)
  const byCity = Object.entries(
    geoLocated.reduce<Record<string, number>>((acc, v) => {
      const key = v.geo_city ?? v.geo_state ?? 'Unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const byMethod = Object.entries(
    geoVisits.reduce<Record<string, number>>((acc, v) => {
      const key = v.attribution_method ?? 'direct'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
  )

  const avgConf = geoVisits.length
    ? geoVisits.reduce((s, v) => s + (v.attribution_confidence ?? 0), 0) / geoVisits.length
    : 0

  async function saveAudience() {
    if (!audienceName.trim()) { toast.error('Audience name required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/ooh/geo-audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ooh_site_id:     siteId,
          audience_name:   audienceName.trim(),
          platform,
          fence_radius_m:  parseInt(radius) || 500,
          creative_headline: headline.trim() || null,
        }),
      })
      const json = await res.json() as { audience?: GeoAudience; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to create audience')
      toast.success('Audience created — click Sync to push to ' + (platform === 'meta' ? 'Meta Ads' : 'Google Ads'))
      if (json.audience) setLocalAudiences(prev => [json.audience!, ...prev])
      setShowNewAudience(false)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">

      {/* Geo Attribution Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-brand" />
          Geo Attribution
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Website visits attributed to this OOH site via branded link clicks or proximity matching.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total visits',     value: geoVisits.length.toLocaleString() },
          { label: 'Geo-located',      value: geoLocated.length.toLocaleString() },
          { label: 'Avg confidence',   value: geoVisits.length ? `${(avgConf * 100).toFixed(0)}%` : '—' },
          { label: 'Unique cities',    value: byCity.length.toString() },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <div className="text-2xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {geoVisits.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <Globe className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">No attributed visits yet</p>
          <p className="text-sm text-muted-foreground">
            Share the branded link for this site — every click will be geo-tagged and attributed here.
            Proximity-matched visits from your website will also appear once traffic grows.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Visits by city */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Visits by Area
            </h3>
            {byCity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No geo data yet</p>
            ) : byCity.map(([city, count]) => (
              <div key={city} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{city}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--brand-primary,#E8763E)]"
                    style={{ width: `${(count / byCity[0][1]) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </Card>

          {/* Attribution method breakdown */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Attribution Method
            </h3>
            {byMethod.map(([method, count]) => {
              const label = METHOD_LABELS[method] ?? method
              const pct = Math.round((count / geoVisits.length) * 100)
              return (
                <div key={method} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="text-muted-foreground tabular-nums">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {geoVisits.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                Avg attribution confidence: {' '}
                <span className={cn('font-medium', CONFIDENCE_COLOR(avgConf))}>
                  {(avgConf * 100).toFixed(0)}%
                </span>
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Recent geo visits */}
      {geoVisits.length > 0 && (
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold">Recent Attributed Visits</h3>
          <div className="divide-y">
            {geoVisits.slice(0, 10).map(v => (
              <div key={v.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {v.device_type === 'mobile'
                    ? <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="text-sm truncate">
                    {[v.geo_city, v.geo_state].filter(Boolean).join(', ') || 'Unknown location'}
                  </span>
                  {v.attribution_method && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {METHOD_LABELS[v.attribution_method] ?? v.attribution_method}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{fmtDate(v.visited_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Separator />

      {/* Geo-retargeting Audiences */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-brand" />
              Geo-Retargeting Audiences
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              People who passed near this billboard will see your ad again on Meta or Google.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewAudience(v => !v)}>
            <Plus className="h-4 w-4" /> New Audience
          </Button>
        </div>

        {/* How it works */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">How it works</h4>
          <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
            <li>Define a geo-fence radius around this OOH site (e.g., 500m)</li>
            <li>BrandGauge builds an audience of people who visited that area</li>
            <li>The audience syncs to Meta Ads or Google Ads</li>
            <li>Anyone who saw your billboard then sees the matching ad in their feed — the same creative, closing the loop</li>
          </ol>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
            Requires Meta Ads Manager connection with ads_management permission.
          </p>
        </Card>

        {/* New audience form */}
        {showNewAudience && (
          <Card className="p-5 space-y-4 border-dashed">
            <h3 className="text-sm font-semibold">Configure Audience</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Audience name</Label>
                <Input
                  value={audienceName}
                  onChange={e => setAudienceName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Platform</Label>
                <Select value={platform} onValueChange={v => setPlatform(v ?? 'meta')}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta Ads (Facebook + Instagram)</SelectItem>
                    <SelectItem value="google">Google Ads (Display + YouTube)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fence radius (metres)</Label>
                <Select value={radius} onValueChange={v => setRadius(v ?? '500')}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="200">200m — Immediate vicinity</SelectItem>
                    <SelectItem value="500">500m — Walking distance</SelectItem>
                    <SelectItem value="1000">1km — Neighbourhood</SelectItem>
                    <SelectItem value="2000">2km — Local area</SelectItem>
                    <SelectItem value="5000">5km — District</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ad headline for retargeting</Label>
                <Input
                  placeholder={`You saw us at ${siteCity ?? 'the billboard'} — shop now`}
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={saveAudience} disabled={saving}>
                {saving ? 'Saving…' : 'Save Audience'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewAudience(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {/* Existing audiences */}
        {localAudiences.length === 0 && !showNewAudience ? (
          <Card className="p-6 text-center space-y-2">
            <Radio className="h-7 w-7 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No audiences configured yet.</p>
            <p className="text-xs text-muted-foreground">
              Create a geo-fence audience to start retargeting people who passed this billboard.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {localAudiences.map(aud => {
              const meta = STATUS_META[aud.status] ?? STATUS_META.draft
              const StatusIcon = meta.icon
              return (
                <Card key={aud.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{aud.audience_name}</span>
                      <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', meta.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">{aud.platform}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{aud.fence_radius_m}m fence</span>
                      {aud.estimated_reach && <span>~{aud.estimated_reach.toLocaleString()} reach</span>}
                      {aud.creative_headline && <span className="italic truncate">"{aud.creative_headline}"</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(aud.status === 'draft' || aud.status === 'error') && aud.platform === 'meta' && (
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs gap-1"
                        disabled={syncing === aud.id}
                        onClick={async () => {
                          setSyncing(aud.id)
                          try {
                            const res  = await fetch(`/api/ooh/geo-audiences/${aud.id}/sync`, { method: 'POST' })
                            const data = await res.json() as {
                              ok?: boolean
                              estimated_reach?: number
                              lower_bound?: number
                              upper_bound?: number
                              error?: string
                            }
                            if (!res.ok) throw new Error(data.error ?? 'Sync failed')
                            const lo = data.lower_bound?.toLocaleString()
                            const hi = data.upper_bound?.toLocaleString()
                            toast.success(`Synced — estimated reach ${lo}–${hi} people`)
                            setLocalAudiences(prev => prev.map(a =>
                              a.id === aud.id
                                ? { ...a, status: 'active', estimated_reach: data.estimated_reach ?? a.estimated_reach }
                                : a
                            ))
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Sync failed')
                            setLocalAudiences(prev => prev.map(a =>
                              a.id === aud.id ? { ...a, status: 'error' } : a
                            ))
                          } finally {
                            setSyncing(null)
                          }
                        }}
                      >
                        {syncing === aud.id
                          ? <><Zap className="h-3 w-3 animate-pulse" />Syncing…</>
                          : <><ExternalLink className="h-3 w-3" />Sync to Meta</>
                        }
                      </Button>
                    )}
                    {(aud.status === 'draft' || aud.status === 'error') && aud.platform === 'google' && (
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => {
                          toast.info('Google Ads sync coming soon.')
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Sync to Google
                      </Button>
                    )}
                    {aud.status === 'active' && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600">
                        <Users className="h-3.5 w-3.5" />
                        Live
                      </div>
                    )}
                    {aud.status === 'syncing' && (
                      <div className="flex items-center gap-1 text-xs text-blue-600">
                        <Zap className="h-3.5 w-3.5 animate-pulse" />
                        Syncing
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
