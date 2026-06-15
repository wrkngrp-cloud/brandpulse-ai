'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import { Button }                  from '@/components/ui/button'
import { Input }                   from '@/components/ui/input'
import { Label }                   from '@/components/ui/label'
import { toast }                   from 'sonner'
import { startGeoLiftStudy }       from './actions'

const CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan']

interface Campaign {
  id:   string
  name: string
}

interface Props {
  brandId:    string
  brandName:  string
  campaigns:  Campaign[]
}

export function GeoLiftStartForm({ brandId, brandName, campaigns }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [treatmentCity, setTreatmentCity] = useState('Lagos')
  const [controlCity,   setControlCity]   = useState('Abuja')
  const [keyword,       setKeyword]       = useState(brandName)
  const [campaignId,    setCampaignId]    = useState('')
  const [studyStart,    setStudyStart]    = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  )
  const [studyEnd, setStudyEnd] = useState(
    new Date().toISOString().slice(0, 10),
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (treatmentCity === controlCity) {
      toast.error('Treatment and control cities must be different.')
      return
    }

    startTransition(async () => {
      const result = await startGeoLiftStudy({
        brandId,
        campaignId:    campaignId || null,
        treatmentCity,
        controlCity,
        keyword:       keyword.trim() || brandName,
        studyStart,
        studyEnd,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Study started — results will appear here in a few minutes.')
        router.refresh()
      }
    })
  }

  const availableControls = CITIES.filter(c => c !== treatmentCity)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Campaign picker */}
      {campaigns.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="glCampaign">Campaign (optional)</Label>
          <select
            id="glCampaign"
            value={campaignId}
            onChange={e => setCampaignId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">No campaign — brand-level study</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="glTreatment">Treatment city</Label>
          <select
            id="glTreatment"
            value={treatmentCity}
            onChange={e => {
              setTreatmentCity(e.target.value)
              if (controlCity === e.target.value) {
                const next = CITIES.find(c => c !== e.target.value) ?? 'Abuja'
                setControlCity(next)
              }
            }}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="glControl">Control city</Label>
          <select
            id="glControl"
            value={controlCity}
            onChange={e => setControlCity(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {availableControls.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="glKeyword">Keyword to track</Label>
        <Input
          id="glKeyword"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder={brandName}
          required
        />
        <p className="text-xs text-muted-foreground">
          Usually your brand name. Google Trends will track this keyword in both cities.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="glStart">Study start</Label>
          <Input
            id="glStart"
            type="date"
            value={studyStart}
            onChange={e => setStudyStart(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="glEnd">Study end</Label>
          <Input
            id="glEnd"
            type="date"
            value={studyEnd}
            onChange={e => setStudyEnd(e.target.value)}
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        A minimum of 4 weeks gives statistically meaningful results. 8–12 weeks is ideal.
      </p>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? 'Starting study…' : 'Start study'}
      </Button>
    </form>
  )
}
