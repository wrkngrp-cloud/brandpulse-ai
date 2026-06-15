'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Action {
  label:   string
  href?:   string
  onClick?: () => void
  primary?: boolean
}

interface EmptyStateProps {
  icon:        React.ElementType
  title:       string
  description: string
  actions?:    Action[]
  className?:  string
  size?:       'sm' | 'md' | 'lg'
  tone?:       'default' | 'blue' | 'clay'
}

const SIZE = {
  sm: { wrap: 'py-8',  icon: 'h-9 w-9',  iconInner: 'h-4 w-4',  title: 'text-sm',    desc: 'text-[12px]' },
  md: { wrap: 'py-12', icon: 'h-12 w-12', iconInner: 'h-5 w-5',  title: 'text-[15px]', desc: 'text-[13px]' },
  lg: { wrap: 'py-16', icon: 'h-16 w-16', iconInner: 'h-7 w-7',  title: 'text-[17px]', desc: 'text-[13.5px]' },
}

const TONE_ICON: Record<string, string> = {
  default: 'bg-muted/60 text-muted-foreground/40',
  blue:    'bg-primary/8 text-primary/50',
  clay:    'bg-[#D4602A]/8 text-[#D4602A]/60',
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions = [],
  className,
  size = 'md',
  tone = 'default',
}: EmptyStateProps) {
  const s = SIZE[size]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex flex-col items-center justify-center text-center gap-4',
        s.wrap,
        className,
      )}
    >
      {/* Icon container */}
      <div className={cn(
        'rounded-2xl flex items-center justify-center shrink-0',
        s.icon,
        TONE_ICON[tone],
      )}>
        <Icon className={cn(s.iconInner)} />
      </div>

      {/* Copy */}
      <div className="space-y-1.5 max-w-[280px]">
        <p className={cn('font-semibold tracking-tight', s.title)}>{title}</p>
        <p className={cn('text-muted-foreground/65 leading-relaxed', s.desc)}>{description}</p>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {actions.map(a => {
            const cls = cn(
              'inline-flex items-center h-8 rounded-xl px-4 text-[12.5px] font-semibold transition-all duration-150 active:scale-[0.98]',
              a.primary
                ? 'text-white hover:opacity-90'
                : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )
            const style = a.primary
              ? { background: 'linear-gradient(135deg, #E8763E 0%, #C4501D 100%)', boxShadow: '0 4px 14px -4px rgba(212,96,42,0.5)' }
              : undefined

            if (a.href) {
              return (
                <Link key={a.label} href={a.href} className={cls} style={style}>
                  {a.label}
                </Link>
              )
            }
            return (
              <button key={a.label} onClick={a.onClick} className={cls} style={style}>
                {a.label}
              </button>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
