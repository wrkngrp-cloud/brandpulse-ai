'use client'

import type { TrustScore } from '@/lib/bhi'
import { Shield, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'

interface Props {
  trust: TrustScore
}

const GRADE_CONFIG = {
  excellent: { icon: ShieldCheck, color: 'text-pos', bg: 'bg-shell dark:bg-shell/30', label: 'Excellent' },
  good:      { icon: Shield,      color: 'text-tx-2',    bg: 'bg-flare-wash dark:bg-shell/30',       label: 'Good' },
  fair:      { icon: ShieldAlert, color: 'text-tx-2',   bg: 'bg-shell dark:bg-shell/30',     label: 'Fair' },
  poor:      { icon: ShieldX,     color: 'text-tx-flare',     bg: 'bg-flare-wash dark:bg-shell/30',         label: 'Needs attention' },
} as const

const DIMENSION_LABELS: Record<keyof TrustScore['breakdown'], string> = {
  appStoreRating:     'App Store Rating',
  regulatoryStanding: 'Regulatory Standing',
  reliabilitySignal:  'Reliability Signal',
  complaintHealth:    'Complaint Health',
}

export function TrustPillarCard({ trust }: Props) {
  const cfg  = trust.grade ? GRADE_CONFIG[trust.grade] : null
  const Icon = cfg?.icon ?? Shield

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Trust Score</p>
          <p className="text-xs text-muted-foreground mt-0.5">Fintech brand integrity</p>
        </div>
        {trust.score != null && cfg ? (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${cfg.bg}`}>
            <Icon className={`w-4 h-4 ${cfg.color}`} />
            <span className={`text-sm font-semibold bg-num ${cfg.color}`}>{trust.score}/100</span>
            <span className={`text-xs ${cfg.color} opacity-80`}>{cfg.label}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground italic">No data yet</span>
        )}
      </div>

      <div className="space-y-2.5">
        {(Object.keys(trust.breakdown) as (keyof typeof trust.breakdown)[]).map(key => {
          const dim   = trust.breakdown[key]
          const label = DIMENSION_LABELS[key]
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs text-muted-foreground/60">
                  {dim.score != null ? `${dim.score}/100` : '—'} · {dim.weight}%
                  {dim.display && <span className="ml-1.5 opacity-70">{dim.display}</span>}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    dim.score == null   ? 'w-0' :
                    dim.score >= 80     ? 'bg-pos' :
                    dim.score >= 60     ? 'bg-flare' :
                    dim.score >= 40     ? 'bg-ember' : 'bg-flare'
                  }`}
                  style={{ width: dim.score != null ? `${dim.score}%` : '0%' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {trust.grade === 'poor' && (
        <p className="text-xs text-tx-flare/80 border-t pt-3">
          Trust signals are below threshold. Check for recent complaint surges, regulatory notices, or low app store ratings.
        </p>
      )}
      {trust.grade === null && (
        <p className="text-xs text-muted-foreground/60 border-t pt-3 italic">
          Connect your App Store IDs and ensure sentiment data is flowing to see your trust score.
        </p>
      )}
    </div>
  )
}
