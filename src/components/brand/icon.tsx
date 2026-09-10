/**
 * The BrandGauge icon set, as React.
 *
 * 107 glyphs, supplied in brand/icons/ and built into the sprite at
 * brand/icons.svg, which mounts once in the root layout. Nothing here is
 * redrawn: the components only reference the artwork by id.
 *
 * Icons are --tx or --tx-3. An icon is Flare only when it is the single hero
 * element of a card, and then it is a filled tick rather than a stroke.
 *
 *   <GaugeIcon className="h-4 w-4" />
 *   <Icon name="bg-gauge" size={16} />
 *   <Icon lucide="TrendingUp" />      // the name a library icon had here
 */
import type { SVGProps } from 'react'

export type BrandIconName =
  | 'bg-alert'
  | 'bg-arrow-updown'
  | 'bg-arrow'
  | 'bg-ask'
  | 'bg-book'
  | 'bg-bot'
  | 'bg-bottle'
  | 'bg-briefcase'
  | 'bg-calendar'
  | 'bg-camera'
  | 'bg-card'
  | 'bg-check'
  | 'bg-chevron'
  | 'bg-chevrons-updown'
  | 'bg-circle-dot'
  | 'bg-clipboard-list'
  | 'bg-clipboard'
  | 'bg-clock'
  | 'bg-code'
  | 'bg-connect'
  | 'bg-copy'
  | 'bg-creative'
  | 'bg-currency'
  | 'bg-database'
  | 'bg-edit'
  | 'bg-export'
  | 'bg-external-link'
  | 'bg-eye'
  | 'bg-field'
  | 'bg-file-search'
  | 'bg-file'
  | 'bg-film'
  | 'bg-filter'
  | 'bg-flag'
  | 'bg-flask'
  | 'bg-funnel'
  | 'bg-gauge'
  | 'bg-gift'
  | 'bg-git-branch'
  | 'bg-git-fork'
  | 'bg-globe'
  | 'bg-heart'
  | 'bg-help'
  | 'bg-history'
  | 'bg-image'
  | 'bg-info'
  | 'bg-key'
  | 'bg-layers'
  | 'bg-layout-grid'
  | 'bg-lightbulb'
  | 'bg-link'
  | 'bg-lock'
  | 'bg-logout'
  | 'bg-mail'
  | 'bg-map'
  | 'bg-market'
  | 'bg-mentions'
  | 'bg-menu'
  | 'bg-message-question'
  | 'bg-message-quote'
  | 'bg-minus'
  | 'bg-moon'
  | 'bg-more'
  | 'bg-mouse-pointer'
  | 'bg-music'
  | 'bg-ooh'
  | 'bg-panel'
  | 'bg-pause'
  | 'bg-phone'
  | 'bg-play'
  | 'bg-plus'
  | 'bg-printer'
  | 'bg-qr'
  | 'bg-refresh'
  | 'bg-saas'
  | 'bg-search-x'
  | 'bg-search'
  | 'bg-send'
  | 'bg-settings'
  | 'bg-share-nodes'
  | 'bg-share'
  | 'bg-shelf'
  | 'bg-shield-alert'
  | 'bg-shield-check'
  | 'bg-shield-x'
  | 'bg-shield'
  | 'bg-smartphone'
  | 'bg-star'
  | 'bg-sun'
  | 'bg-survey'
  | 'bg-tag'
  | 'bg-thumbs-down'
  | 'bg-thumbs-up'
  | 'bg-toggle'
  | 'bg-trash'
  | 'bg-trend-down'
  | 'bg-trend'
  | 'bg-triangle-alert'
  | 'bg-truck'
  | 'bg-unplug'
  | 'bg-users'
  | 'bg-venue'
  | 'bg-wand'
  | 'bg-wifi-off'
  | 'bg-wrench'
  | 'bg-x-circle'
  | 'bg-x'

/**
 * What each library icon this product used to import became. Kept so a call
 * site can name the glyph it wants in the old vocabulary without anyone
 * having to remember the new one.
 */
export const LUCIDE_TO_BRAND = {
  Activity: 'bg-trend',
  AlertCircle: 'bg-alert',
  AlertTriangle: 'bg-triangle-alert',
  ArrowLeft: 'bg-arrow',
  ArrowRight: 'bg-arrow',
  ArrowUpDown: 'bg-arrow-updown',
  ArrowUpRight: 'bg-arrow',
  Award: 'bg-star',
  BarChart2: 'bg-trend',
  BarChart3: 'bg-trend',
  Bell: 'bg-alert',
  BookOpen: 'bg-book',
  Bot: 'bg-bot',
  Briefcase: 'bg-briefcase',
  Building: 'bg-venue',
  Building2: 'bg-venue',
  Calculator: 'bg-currency',
  Calendar: 'bg-calendar',
  CalendarDays: 'bg-calendar',
  Camera: 'bg-camera',
  Check: 'bg-check',
  CheckCheck: 'bg-check',
  CheckCircle: 'bg-check',
  CheckCircle2: 'bg-check',
  CheckSquare: 'bg-check',
  ChevronDown: 'bg-chevron',
  ChevronLeft: 'bg-chevron',
  ChevronRight: 'bg-chevron',
  ChevronUp: 'bg-chevron',
  ChevronsUpDown: 'bg-chevrons-updown',
  CircleDot: 'bg-circle-dot',
  Clipboard: 'bg-clipboard',
  ClipboardCheck: 'bg-clipboard',
  ClipboardEdit: 'bg-edit',
  ClipboardList: 'bg-clipboard-list',
  Clock: 'bg-clock',
  Code2: 'bg-code',
  Coins: 'bg-currency',
  Copy: 'bg-copy',
  Crosshair: 'bg-circle-dot',
  Database: 'bg-database',
  DollarSign: 'bg-currency',
  Download: 'bg-export',
  Edit: 'bg-edit',
  ExternalLink: 'bg-external-link',
  Eye: 'bg-eye',
  FileDown: 'bg-export',
  FileSearch: 'bg-file-search',
  FileSpreadsheet: 'bg-file',
  FileText: 'bg-file',
  Film: 'bg-film',
  Filter: 'bg-filter',
  Flag: 'bg-flag',
  Flame: 'bg-ask',
  FlaskConical: 'bg-flask',
  Gift: 'bg-gift',
  GitBranch: 'bg-git-branch',
  GitFork: 'bg-git-fork',
  Globe: 'bg-globe',
  Globe2: 'bg-globe',
  Handshake: 'bg-users',
  Heart: 'bg-heart',
  HelpCircle: 'bg-help',
  History: 'bg-history',
  Image: 'bg-image',
  ImageIcon: 'bg-image',
  ImagePlus: 'bg-image',
  Images: 'bg-image',
  Info: 'bg-info',
  Key: 'bg-key',
  Layers: 'bg-layers',
  LayoutDashboard: 'bg-layout-grid',
  LayoutGrid: 'bg-layout-grid',
  Lightbulb: 'bg-lightbulb',
  Link: 'bg-link',
  Link2: 'bg-link',
  Loader2: 'bg-refresh',
  Lock: 'bg-lock',
  LogOut: 'bg-logout',
  Mail: 'bg-mail',
  Map: 'bg-map',
  MapPin: 'bg-map',
  Megaphone: 'bg-music',
  Menu: 'bg-menu',
  MessageCircle: 'bg-mentions',
  MessageCircleQuestion: 'bg-message-question',
  MessageSquare: 'bg-mentions',
  MessageSquareQuote: 'bg-message-quote',
  MessageSquareText: 'bg-mentions',
  Minus: 'bg-minus',
  MinusCircle: 'bg-minus',
  Monitor: 'bg-panel',
  Moon: 'bg-moon',
  MoreHorizontal: 'bg-more',
  MousePointer: 'bg-mouse-pointer',
  MousePointerClick: 'bg-mouse-pointer',
  Music2: 'bg-music',
  Newspaper: 'bg-file',
  Package: 'bg-briefcase',
  Palette: 'bg-creative',
  PanelLeft: 'bg-panel',
  PanelLeftClose: 'bg-panel',
  Pause: 'bg-pause',
  PauseCircle: 'bg-pause',
  PenLine: 'bg-edit',
  Pencil: 'bg-edit',
  Percent: 'bg-currency',
  Phone: 'bg-phone',
  PieChart: 'bg-share',
  Play: 'bg-play',
  PlayCircle: 'bg-play',
  Plug: 'bg-connect',
  Plus: 'bg-plus',
  Printer: 'bg-printer',
  QrCode: 'bg-qr',
  Radio: 'bg-music',
  RefreshCw: 'bg-refresh',
  RotateCcw: 'bg-refresh',
  Rss: 'bg-music',
  Search: 'bg-search',
  SearchX: 'bg-search-x',
  Send: 'bg-send',
  Settings: 'bg-settings',
  Settings2: 'bg-settings',
  Share2: 'bg-share-nodes',
  Shield: 'bg-shield',
  ShieldAlert: 'bg-shield-alert',
  ShieldCheck: 'bg-shield-check',
  ShieldX: 'bg-shield-x',
  ShoppingBag: 'bg-market',
  ShoppingCart: 'bg-market',
  SlidersHorizontal: 'bg-filter',
  Smartphone: 'bg-smartphone',
  Smile: 'bg-heart',
  Sparkles: 'bg-ask',
  Square: 'bg-layout-grid',
  Star: 'bg-star',
  Sun: 'bg-sun',
  Swords: 'bg-star',
  Tag: 'bg-tag',
  Target: 'bg-circle-dot',
  ThumbsDown: 'bg-thumbs-down',
  ThumbsUp: 'bg-thumbs-up',
  ToggleLeft: 'bg-toggle',
  ToggleRight: 'bg-toggle',
  Trash2: 'bg-trash',
  TrendingDown: 'bg-trend-down',
  TrendingUp: 'bg-trend',
  TriangleAlert: 'bg-triangle-alert',
  Trophy: 'bg-star',
  Tv: 'bg-panel',
  Unplug: 'bg-unplug',
  Upload: 'bg-export',
  User: 'bg-users',
  UserCheck: 'bg-users',
  UserX: 'bg-users',
  Users: 'bg-users',
  Users2: 'bg-users',
  Video: 'bg-film',
  Volume2: 'bg-music',
  Wand2: 'bg-wand',
  WifiOff: 'bg-wifi-off',
  Wrench: 'bg-wrench',
  X: 'bg-x',
  XCircle: 'bg-x-circle',
  Zap: 'bg-ask',
} as const

export type LucideName = keyof typeof LUCIDE_TO_BRAND

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name?: BrandIconName
  lucide?: LucideName
  size?: number
  title?: string
}

export function Icon({ name, lucide, className, size, title, ...rest }: IconProps) {
  const id = name ?? (lucide ? LUCIDE_TO_BRAND[lucide] : 'bg-gauge')
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
      {...rest}
    >
      {title && <title>{title}</title>}
      <use href={`#${id}`} />
    </svg>
  )
}

/**
 * Direction, by rotating the one glyph.
 *
 * The set draws a single chevron and a single arrow, pointing down and right.
 * The others are that same artwork turned, the way the atom itself is one path
 * in transformed copies — never a second drawing of the same shape.
 */
function turned(name: BrandIconName, deg: number) {
  const C = ({ style, ...props }: Omit<IconProps, 'name' | 'lucide'>) => (
    <Icon
      name={name}
      style={deg ? { transform: `rotate(${deg}deg)`, ...style } : style}
      {...props}
    />
  )
  C.displayName = `${name}-${deg}`
  return C
}

export const ChevronDownIcon  = turned('bg-chevron', 0)
export const ChevronUpIcon    = turned('bg-chevron', 180)
export const ChevronRightIcon = turned('bg-chevron', -90)
export const ChevronLeftIcon  = turned('bg-chevron', 90)

export const ArrowRightIcon = turned('bg-arrow', 0)
export const ArrowLeftIcon  = turned('bg-arrow', 180)
export const ArrowUpIcon    = turned('bg-arrow', -90)
export const ArrowDownIcon  = turned('bg-arrow', 90)

/** Named components, so an icon slots in wherever a library icon stood. */
const named = (name: BrandIconName) => {
  const C = (props: Omit<IconProps, 'name' | 'lucide'>) => <Icon name={name} {...props} />
  C.displayName = name
  return C
}

export const AlertIcon = named('bg-alert')
export const ArrowUpdownIcon = named('bg-arrow-updown')
export const ArrowIcon = named('bg-arrow')
export const AskIcon = named('bg-ask')
export const BookIcon = named('bg-book')
export const BotIcon = named('bg-bot')
export const BottleIcon = named('bg-bottle')
export const BriefcaseIcon = named('bg-briefcase')
export const CalendarIcon = named('bg-calendar')
export const CameraIcon = named('bg-camera')
export const CardIcon = named('bg-card')
export const CheckIcon = named('bg-check')
export const ChevronIcon = named('bg-chevron')
export const ChevronsUpdownIcon = named('bg-chevrons-updown')
export const CircleDotIcon = named('bg-circle-dot')
export const ClipboardListIcon = named('bg-clipboard-list')
export const ClipboardIcon = named('bg-clipboard')
export const ClockIcon = named('bg-clock')
export const CodeIcon = named('bg-code')
export const ConnectIcon = named('bg-connect')
export const CopyIcon = named('bg-copy')
export const CreativeIcon = named('bg-creative')
export const CurrencyIcon = named('bg-currency')
export const DatabaseIcon = named('bg-database')
export const EditIcon = named('bg-edit')
export const ExportIcon = named('bg-export')
export const ExternalLinkIcon = named('bg-external-link')
export const EyeIcon = named('bg-eye')
export const FieldIcon = named('bg-field')
export const FileSearchIcon = named('bg-file-search')
export const FileIcon = named('bg-file')
export const FilmIcon = named('bg-film')
export const FilterIcon = named('bg-filter')
export const FlagIcon = named('bg-flag')
export const FlaskIcon = named('bg-flask')
export const FunnelIcon = named('bg-funnel')
export const GaugeIcon = named('bg-gauge')
export const GiftIcon = named('bg-gift')
export const GitBranchIcon = named('bg-git-branch')
export const GitForkIcon = named('bg-git-fork')
export const GlobeIcon = named('bg-globe')
export const HeartIcon = named('bg-heart')
export const HelpIcon = named('bg-help')
export const HistoryIcon = named('bg-history')
export const ImageIcon = named('bg-image')
export const InfoIcon = named('bg-info')
export const KeyIcon = named('bg-key')
export const LayersIcon = named('bg-layers')
export const LayoutGridIcon = named('bg-layout-grid')
export const LightbulbIcon = named('bg-lightbulb')
export const LinkIcon = named('bg-link')
export const LockIcon = named('bg-lock')
export const LogoutIcon = named('bg-logout')
export const MailIcon = named('bg-mail')
export const MapIcon = named('bg-map')
export const MarketIcon = named('bg-market')
export const MentionsIcon = named('bg-mentions')
export const MenuIcon = named('bg-menu')
export const MessageQuestionIcon = named('bg-message-question')
export const MessageQuoteIcon = named('bg-message-quote')
export const MinusIcon = named('bg-minus')
export const MoonIcon = named('bg-moon')
export const MoreIcon = named('bg-more')
export const MousePointerIcon = named('bg-mouse-pointer')
export const MusicIcon = named('bg-music')
export const OohIcon = named('bg-ooh')
export const PanelIcon = named('bg-panel')
export const PauseIcon = named('bg-pause')
export const PhoneIcon = named('bg-phone')
export const PlayIcon = named('bg-play')
export const PlusIcon = named('bg-plus')
export const PrinterIcon = named('bg-printer')
export const QrIcon = named('bg-qr')
export const RefreshIcon = named('bg-refresh')
export const SaasIcon = named('bg-saas')
export const SearchXIcon = named('bg-search-x')
export const SearchIcon = named('bg-search')
export const SendIcon = named('bg-send')
export const SettingsIcon = named('bg-settings')
export const ShareNodesIcon = named('bg-share-nodes')
export const ShareIcon = named('bg-share')
export const ShelfIcon = named('bg-shelf')
export const ShieldAlertIcon = named('bg-shield-alert')
export const ShieldCheckIcon = named('bg-shield-check')
export const ShieldXIcon = named('bg-shield-x')
export const ShieldIcon = named('bg-shield')
export const SmartphoneIcon = named('bg-smartphone')
export const StarIcon = named('bg-star')
export const SunIcon = named('bg-sun')
export const SurveyIcon = named('bg-survey')
export const TagIcon = named('bg-tag')
export const ThumbsDownIcon = named('bg-thumbs-down')
export const ThumbsUpIcon = named('bg-thumbs-up')
export const ToggleIcon = named('bg-toggle')
export const TrashIcon = named('bg-trash')
export const TrendDownIcon = named('bg-trend-down')
export const TrendIcon = named('bg-trend')
export const TriangleAlertIcon = named('bg-triangle-alert')
export const TruckIcon = named('bg-truck')
export const UnplugIcon = named('bg-unplug')
export const UsersIcon = named('bg-users')
export const VenueIcon = named('bg-venue')
export const WandIcon = named('bg-wand')
export const WifiOffIcon = named('bg-wifi-off')
export const WrenchIcon = named('bg-wrench')
export const XCircleIcon = named('bg-x-circle')
export const XIcon = named('bg-x')
