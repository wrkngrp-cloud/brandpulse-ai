/**
 * The BrandGauge icon set, as React.
 *
 * The 22 glyphs live in brand/icons.svg, mounted once in the root layout.
 * This wraps the kit's Icon so an icon can be dropped in wherever a lucide
 * icon stood, keeping the className the caller already passes for sizing.
 *
 * Icons are --tx or --tx-3. An icon is Flare only when it is the single hero
 * element of a card, and then it is a filled tick rather than a stroke.
 *
 * There are 22 icons and no more. If a glyph is missing, it gets drawn on the
 * construction grid in section 7 of the design system — never substituted
 * from a library.
 */
export type BrandIconName =
  | 'bg-gauge' | 'bg-mentions' | 'bg-funnel' | 'bg-ooh' | 'bg-survey'
  | 'bg-share' | 'bg-field' | 'bg-creative' | 'bg-ask' | 'bg-connect'
  | 'bg-trend' | 'bg-alert' | 'bg-export' | 'bg-filter' | 'bg-search'
  | 'bg-shelf' | 'bg-card' | 'bg-venue' | 'bg-saas' | 'bg-market'
  | 'bg-bottle' | 'bg-truck'

interface IconProps {
  name: BrandIconName
  className?: string
  size?: number
  title?: string
}

export function Icon({ name, className, size, title }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <use href={`#${name}`} />
    </svg>
  )
}

/** Named components, so an icon slots in wherever a lucide icon stood. */
const named = (name: BrandIconName) => {
  const C = (props: { className?: string; size?: number; title?: string }) => (
    <Icon name={name} {...props} />
  )
  C.displayName = name
  return C
}

export const GaugeIcon    = named('bg-gauge')
export const MentionsIcon = named('bg-mentions')
export const FunnelIcon   = named('bg-funnel')
export const OohIcon      = named('bg-ooh')
export const SurveyIcon   = named('bg-survey')
export const ShareIcon    = named('bg-share')
export const FieldIcon    = named('bg-field')
export const CreativeIcon = named('bg-creative')
export const AskIcon      = named('bg-ask')
export const ConnectIcon  = named('bg-connect')
export const TrendIcon    = named('bg-trend')
export const AlertIcon    = named('bg-alert')
export const ExportIcon   = named('bg-export')
export const FilterIcon   = named('bg-filter')
export const SearchIcon   = named('bg-search')

/** The seven verticals, one glyph each. */
export const ShelfIcon    = named('bg-shelf')    // FMCG
export const CardIcon     = named('bg-card')     // fintech
export const VenueIcon    = named('bg-venue')    // venues
export const SaasIcon     = named('bg-saas')     // B2B SaaS
export const MarketIcon   = named('bg-market')   // marketplaces
export const BottleIcon   = named('bg-bottle')   // beverage
export const TruckIcon    = named('bg-truck')    // distribution
