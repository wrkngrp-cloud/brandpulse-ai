'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const PLUTCHIK: Record<string, { color: string; label: string }> = {
  joy:          { color: 'var(--danfo)', label: 'Joy'          },
  trust:        { color: 'var(--pos)', label: 'Trust'        },
  fear:         { color: 'var(--pos)', label: 'Fear'         },
  surprise:     { color: 'var(--neu)', label: 'Surprise'     },
  sadness:      { color: 'var(--ember)', label: 'Sadness'      },
  disgust:      { color: 'var(--neu)', label: 'Disgust'      },
  anger:        { color: 'var(--flare)', label: 'Anger'        },
  anticipation: { color: 'var(--danfo)', label: 'Anticipation' },
}

interface Props {
  distribution: Record<string, number>
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: { name: string; value: number; payload: { color: string } }[]
}) {
  if (!active || !payload?.length) return null
  const { name, value, payload: p } = payload[0]
  return (
    <div className="bg-card border rounded-lg shadow px-3 py-1.5 text-xs">
      <span className="font-semibold capitalize" style={{ color: p.color }}>{name}</span>
      <span className="text-muted-foreground ml-2">{value} mention{value !== 1 ? 's' : ''}</span>
    </div>
  )
}

export function EmotionWheel({ distribution }: Props) {
  const total = Object.values(distribution).reduce((s, v) => s + v, 0)
  if (total === 0) return null

  const data = Object.entries(distribution)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({
      name:  PLUTCHIK[key]?.label ?? key,
      value,
      color: PLUTCHIK[key]?.color ?? 'var(--tx-3)',
    }))

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center">
        {data.map(d => (
          <span key={d.name} className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            {d.name}
            <span className="text-muted-foreground/60 bg-num">
              {Math.round((d.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
