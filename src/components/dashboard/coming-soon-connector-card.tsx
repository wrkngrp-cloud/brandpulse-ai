import type { ReactNode } from 'react'

interface Props {
  icon:        ReactNode
  iconBg:      string
  label:       string
  description: string
}

// Placeholder for a connector that's built but not ready to go live yet
// (missing a credential we don't control the timeline on, like a developer
// token pending approval). Keeps the real connect card component intact —
// swap this back out for the real one once the credential lands.
export function ComingSoonConnectorCard({ icon, iconBg, label, description }: Props) {
  return (
    <div className="border rounded-xl p-5 bg-card opacity-60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary rounded px-2 py-1 leading-none">
          Coming soon
        </span>
      </div>
    </div>
  )
}
