import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?:  string
  title:     string
  subtitle?: string
  actions?:  React.ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        'pb-5 mb-6 border-b border-border/60',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="eyebrow mb-1.5">{eyebrow}</p>
        )}
        <h1 className="h-display text-[26px] sm:text-[30px] leading-none">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-[13.5px] text-muted-foreground max-w-[60ch] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
