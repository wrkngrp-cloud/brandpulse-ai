'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast }        from 'sonner'
import { goLive, closeEvent } from '@/app/dashboard/events/actions'
import { Button }       from '@/components/ui/button'
import { Badge }        from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Radio, Square, Users, Target, Handshake, Gift, Camera } from 'lucide-react'

interface Interaction {
  id:               string
  interaction_type: string
  ambassador_id:    string | null
  occurred_at:      string
}

interface Ambassador {
  id:   string
  name: string
}

interface Props {
  eventId:      string
  status:       string
  budget:       number | null
  ambassadors:  Ambassador[]
  initialInteractions: Interaction[]
}

const TYPE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  engaged:           { label: 'Engaged',           color: 'bg-blue-500',   icon: Users    },
  new_lead:          { label: 'New Lead',           color: 'bg-green-500',  icon: Target   },
  new_customer:      { label: 'New Customer',       color: 'bg-emerald-600',icon: Handshake},
  existing_customer: { label: 'Existing Customer',  color: 'bg-purple-500', icon: Users    },
  merch:             { label: 'Merch Given',         color: 'bg-orange-400', icon: Gift     },
  sample:            { label: 'Sample Given',        color: 'bg-yellow-500', icon: Gift     },
  prize:             { label: 'Prize Won',           color: 'bg-pink-500',   icon: Gift     },
  photo:             { label: 'Photo Moment',        color: 'bg-violet-500', icon: Camera   },
}

function buildHourlyData(interactions: Interaction[]): { hour: string; count: number }[] {
  const buckets: Record<string, number> = {}
  for (const ia of interactions) {
    const h = new Date(ia.occurred_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false })
    const key = h.slice(0, 2) + ':00'
    buckets[key] = (buckets[key] ?? 0) + 1
  }
  return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([hour, count]) => ({ hour, count }))
}

export function LiveDashboard({ eventId, status, budget, ambassadors, initialInteractions }: Props) {
  const router = useRouter()
  const [interactions, setInteractions] = useState<Interaction[]>(initialInteractions)
  const [goLivePending,  startGoLive ] = useTransition()
  const [closePending,   startClose  ] = useTransition()

  useEffect(() => {
    if (status !== 'live') return
    const supabase = createClient()
    const channel  = supabase
      .channel(`event-live-${eventId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'event_interactions',
        filter: `event_id=eq.${eventId}`,
      }, payload => {
        setInteractions(prev => [...prev, payload.new as Interaction])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [eventId, status])

  const counts: Record<string, number> = {}
  for (const ia of interactions) {
    counts[ia.interaction_type] = (counts[ia.interaction_type] ?? 0) + 1
  }

  const ambLeaderboard = ambassadors.map(a => ({
    ...a,
    total:  interactions.filter(i => i.ambassador_id === a.id).length,
    leads:  interactions.filter(i => i.ambassador_id === a.id && i.interaction_type === 'new_lead').length,
  })).sort((a, b) => b.total - a.total)

  const hourlyData = buildHourlyData(interactions)

  return (
    <div className="space-y-6">
      {/* Status + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === 'live' && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
              <Radio className="h-4 w-4 animate-pulse" />
              Live
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            {interactions.length} interactions logged
          </span>
        </div>
        <div className="flex gap-2">
          {status === 'planned' && (
            <Button
              size="sm"
              onClick={() => startGoLive(async () => {
                const r = await goLive(eventId)
                if (r?.error) toast.error(r.error)
                else { toast.success('Event is now live!'); router.refresh() }
              })}
              disabled={goLivePending}
            >
              <Radio className="h-4 w-4 mr-1.5" />
              {goLivePending ? 'Going live…' : 'Go live'}
            </Button>
          )}
          {status === 'live' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => startClose(async () => {
                const r = await closeEvent(eventId)
                if (r?.error) toast.error(r.error)
                else { toast.success('Event closed. Fill in the debrief to generate your ROI report.'); router.refresh() }
              })}
              disabled={closePending}
            >
              <Square className="h-4 w-4 mr-1.5" />
              {closePending ? 'Closing…' : 'Close event'}
            </Button>
          )}
        </div>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const Icon = meta.icon
          return (
            <div key={type} className="border rounded-xl p-4 bg-card space-y-2">
              <div className={`h-7 w-7 rounded-md ${meta.color} bg-opacity-15 flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${meta.color.replace('bg-', 'text-')}`} />
              </div>
              <p className="text-2xl font-semibold tabular-nums">{counts[type] ?? 0}</p>
              <p className="text-xs text-muted-foreground">{meta.label}</p>
            </div>
          )
        })}
      </div>

      {/* Sparkline */}
      {hourlyData.length > 0 && (
        <div className="border rounded-xl p-5 bg-card space-y-3">
          <p className="text-sm font-medium">Interactions per hour</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={hourlyData} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font-sans)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontFamily: 'var(--font-sans)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: '#14182B',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#fff',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.10em' }}
                cursor={{ fill: 'currentColor', opacity: 0.05 }}
              />
              <Bar dataKey="count" fill="#2B59FF" radius={[4,4,0,0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ambassador leaderboard */}
      {ambassadors.length > 0 && (
        <div className="border rounded-xl p-5 bg-card space-y-3">
          <p className="text-sm font-medium">Ambassador leaderboard</p>
          <div className="space-y-2">
            {ambLeaderboard.map((a, rank) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4 text-right">{rank + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-sm tabular-nums shrink-0">{a.total}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.leads} leads</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
