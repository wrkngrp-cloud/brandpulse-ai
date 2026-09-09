/**
 * The BrandGauge icon set, as React.
 *
 * The glyphs live in brand/icons.svg, mounted once in the root layout. This
 * wraps them so an icon drops in wherever a library icon stood, keeping the
 * className the caller already passes for sizing.
 *
 * Icons are --tx or --tx-3. An icon is Flare only when it is the single hero
 * element of a card, and then it is a filled tick rather than a stroke.
 *
 * The first 22 are the supplied set. The rest are the UI extension, drawn on
 * the construction grid in section 7 of the design system — 24 grid, 20 live
 * area, 1.75 stroke, butt caps, miter joins, curves at r=2/2.5/6.5/7,
 * diagonals at 45deg or 2:1 — so the product never falls back to a library.
 */
export type BrandIconName =
  | 'bg-gauge'
  | 'bg-mentions'
  | 'bg-funnel'
  | 'bg-ooh'
  | 'bg-survey'
  | 'bg-share'
  | 'bg-field'
  | 'bg-creative'
  | 'bg-ask'
  | 'bg-connect'
  | 'bg-trend'
  | 'bg-alert'
  | 'bg-export'
  | 'bg-filter'
  | 'bg-search'
  | 'bg-shelf'
  | 'bg-card'
  | 'bg-venue'
  | 'bg-saas'
  | 'bg-market'
  | 'bg-bottle'
  | 'bg-truck'
  | 'bg-add'
  | 'bg-remove'
  | 'bg-close'
  | 'bg-tick-mark'
  | 'bg-confirmed'
  | 'bg-blocked'
  | 'bg-down'
  | 'bg-up'
  | 'bg-next'
  | 'bg-back'
  | 'bg-forward'
  | 'bg-return'
  | 'bg-sort'
  | 'bg-refresh'
  | 'bg-copy'
  | 'bg-upload'
  | 'bg-delete'
  | 'bg-edit'
  | 'bg-link'
  | 'bg-open'
  | 'bg-settings'
  | 'bg-more'
  | 'bg-menu'
  | 'bg-exit'
  | 'bg-lock'
  | 'bg-people'
  | 'bg-person'
  | 'bg-place'
  | 'bg-globe'
  | 'bg-clock'
  | 'bg-calendar'
  | 'bg-doc'
  | 'bg-view'
  | 'bg-target'
  | 'bg-award'
  | 'bg-money'
  | 'bg-bars'
  | 'bg-falling'
  | 'bg-pulse'
  | 'bg-info'
  | 'bg-help'
  | 'bg-star'
  | 'bg-heart'
  | 'bg-flag'
  | 'bg-bell'
  | 'bg-mail'
  | 'bg-send'
  | 'bg-phone'
  | 'bg-broadcast'
  | 'bg-screen'
  | 'bg-play'
  | 'bg-pause'
  | 'bg-camera'
  | 'bg-image'
  | 'bg-database'
  | 'bg-package'
  | 'bg-shield'
  | 'bg-shop'
  | 'bg-print'
  | 'bg-code'
  | 'bg-lab'
  | 'bg-toggle'
  | 'bg-offline'
  | 'bg-qr'
  | 'bg-gift'
  | 'bg-handshake'
  | 'bg-sun'
  | 'bg-moon'
  | 'bg-layout'
  | 'bg-grid'
  | 'bg-idea'
  | 'bg-spark'
  | 'bg-panel'
  | 'bg-branch'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: BrandIconName
  size?: number
  title?: string
}

export function Icon({ name, className, size, title, ...rest }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      {...rest}
      viewBox="0 0 24 24"
      fill="currentColor"
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

/** Named components, so an icon slots in wherever a library icon stood. */
const named = (name: BrandIconName) => {
  const C = (props: Omit<IconProps, 'name'>) => (
    <Icon name={name} {...props} />
  )
  C.displayName = name
  return C
}

export const GaugeIcon = named('bg-gauge')
export const MentionsIcon = named('bg-mentions')
export const FunnelIcon = named('bg-funnel')
export const OohIcon = named('bg-ooh')
export const SurveyIcon = named('bg-survey')
export const ShareIcon = named('bg-share')
export const FieldIcon = named('bg-field')
export const CreativeIcon = named('bg-creative')
export const AskIcon = named('bg-ask')
export const ConnectIcon = named('bg-connect')
export const TrendIcon = named('bg-trend')
export const AlertIcon = named('bg-alert')
export const ExportIcon = named('bg-export')
export const FilterIcon = named('bg-filter')
export const SearchIcon = named('bg-search')
export const ShelfIcon = named('bg-shelf')
export const CardIcon = named('bg-card')
export const VenueIcon = named('bg-venue')
export const SaasIcon = named('bg-saas')
export const MarketIcon = named('bg-market')
export const BottleIcon = named('bg-bottle')
export const TruckIcon = named('bg-truck')
export const AddIcon = named('bg-add')
export const RemoveIcon = named('bg-remove')
export const CloseIcon = named('bg-close')
export const TickMarkIcon = named('bg-tick-mark')
export const ConfirmedIcon = named('bg-confirmed')
export const BlockedIcon = named('bg-blocked')
export const DownIcon = named('bg-down')
export const UpIcon = named('bg-up')
export const NextIcon = named('bg-next')
export const BackIcon = named('bg-back')
export const ForwardIcon = named('bg-forward')
export const ReturnIcon = named('bg-return')
export const SortIcon = named('bg-sort')
export const RefreshIcon = named('bg-refresh')
export const CopyIcon = named('bg-copy')
export const UploadIcon = named('bg-upload')
export const DeleteIcon = named('bg-delete')
export const EditIcon = named('bg-edit')
export const LinkIcon = named('bg-link')
export const OpenIcon = named('bg-open')
export const SettingsIcon = named('bg-settings')
export const MoreIcon = named('bg-more')
export const MenuIcon = named('bg-menu')
export const ExitIcon = named('bg-exit')
export const LockIcon = named('bg-lock')
export const PeopleIcon = named('bg-people')
export const PersonIcon = named('bg-person')
export const PlaceIcon = named('bg-place')
export const GlobeIcon = named('bg-globe')
export const ClockIcon = named('bg-clock')
export const CalendarIcon = named('bg-calendar')
export const DocIcon = named('bg-doc')
export const ViewIcon = named('bg-view')
export const TargetIcon = named('bg-target')
export const AwardIcon = named('bg-award')
export const MoneyIcon = named('bg-money')
export const BarsIcon = named('bg-bars')
export const FallingIcon = named('bg-falling')
export const PulseIcon = named('bg-pulse')
export const InfoIcon = named('bg-info')
export const HelpIcon = named('bg-help')
export const StarIcon = named('bg-star')
export const HeartIcon = named('bg-heart')
export const FlagIcon = named('bg-flag')
export const BellIcon = named('bg-bell')
export const MailIcon = named('bg-mail')
export const SendIcon = named('bg-send')
export const PhoneIcon = named('bg-phone')
export const BroadcastIcon = named('bg-broadcast')
export const ScreenIcon = named('bg-screen')
export const PlayIcon = named('bg-play')
export const PauseIcon = named('bg-pause')
export const CameraIcon = named('bg-camera')
export const ImageIcon = named('bg-image')
export const DatabaseIcon = named('bg-database')
export const PackageIcon = named('bg-package')
export const ShieldIcon = named('bg-shield')
export const ShopIcon = named('bg-shop')
export const PrintIcon = named('bg-print')
export const CodeIcon = named('bg-code')
export const LabIcon = named('bg-lab')
export const ToggleIcon = named('bg-toggle')
export const OfflineIcon = named('bg-offline')
export const QrIcon = named('bg-qr')
export const GiftIcon = named('bg-gift')
export const HandshakeIcon = named('bg-handshake')
export const SunIcon = named('bg-sun')
export const MoonIcon = named('bg-moon')
export const LayoutIcon = named('bg-layout')
export const GridIcon = named('bg-grid')
export const IdeaIcon = named('bg-idea')
export const SparkIcon = named('bg-spark')
export const PanelIcon = named('bg-panel')
export const BranchIcon = named('bg-branch')
