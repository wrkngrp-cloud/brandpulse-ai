import { cn } from '@/lib/utils'

/**
 * The one dashboard page header.
 *
 * It already existed and nothing used it, so all thirty-six pages had invented
 * their own: three title scales, two subtitle treatments, tracking on some and
 * not others, an eyebrow on exactly one, an icon on six, and none of them
 * carrying the rule that closes the block. That inconsistency is most of what
 * read as unfinished when moving between screens.
 *
 * Type comes from the brand classes rather than ad-hoc Tailwind sizes:
 * `.h-display` is Nohemi 800 at the display tracking, `.eyebrow` is the
 * section label. The icon sits in a hairlined well, never on a tinted plane,
 * because elevation in this system is drawn as a line.
 */
interface PageHeaderProps {
  /** The nav section this page sits under, e.g. "Brand health". */
  eyebrow?: string
  /** Usually a plain string; a node when the page interpolates the brand name. */
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** The same glyph the nav uses for this route. */
  icon?: React.ElementType
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  eyebrow, title, subtitle, icon: Icon, actions, className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        // No bottom margin: every page that uses this already sits in a
        // space-y-* column, and adding one here double-spaced the first row.
        'flex flex-col gap-3 border-b border-line pb-5',
        'sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon && (
          <span
            aria-hidden
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-line"
          >
            <Icon className="h-[18px] w-[18px] text-tx-2" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h1 className="h-display text-[26px] leading-none sm:text-[30px]">{title}</h1>
          {subtitle && (
            <p className="mt-2 max-w-[68ch] text-[13.5px] leading-relaxed text-tx-3">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
