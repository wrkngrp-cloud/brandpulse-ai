/**
 * Route → the section it sits under and the glyph the nav draws for it.
 *
 * The nav already knew every route's icon; the page headers did not, so six of
 * them had one and thirty did not. This is the one place both read from, so a
 * page and its nav entry can never show different marks for the same screen.
 *
 * Section names are the nav's own, in sentence case — `.eyebrow` sets no
 * transform, and capitals in this system belong to `.bg-label` alone.
 *
 * Titles stay on the pages. A nav entry is short because it lives in a rail
 * ("Brand Health"); a page can say what it actually is ("Brand Equity
 * Tracker"). Only the section and the icon are shared.
 */
import {
  MentionsIcon, GaugeIcon, FunnelIcon, OohIcon, SurveyIcon, ShareIcon,
  FieldIcon, CreativeIcon, MarketIcon,
  FileIcon as FileText, StarIcon as Trophy, GlobeIcon as Globe,
  FileIcon as FileSearch, CameraIcon as Video, EyeIcon as Eye,
  MusicIcon as Megaphone, PanelIcon as Monitor, UsersIcon as Users,
  CalendarIcon as CalendarDays, MusicIcon as Radio, PanelIcon as Tv,
  PrinterIcon as Newspaper, MentionsIcon as MessageCircle,
  AskIcon as Sparkles, PrePostIcon as PrePost, TrendIcon as TrendingUp,
  CheckIcon as ClipboardCheck, CircleDotIcon as Target,
  CurrencyIcon as DollarSign, AlertIcon as AlertTriangle, GiftIcon as Gift,
  HeartIcon as Heart, DatabaseIcon as Database, ExportIcon as FileDown,
  TrendIcon as BarChart3, FileIcon as BookOpen, FlaskIcon as FlaskConical,
  ConnectIcon as Plug, SettingsIcon as Settings,
} from '@/components/brand/icon'

export interface PageMeta {
  eyebrow: string
  icon: React.ElementType
}

export const PAGE_META: Record<string, PageMeta> = {
  /* Brand health — how is my brand doing? */
  '/dashboard/sentiment':         { eyebrow: 'Brand health', icon: MentionsIcon },
  '/dashboard/brand-equity':      { eyebrow: 'Brand health', icon: GaugeIcon },
  '/dashboard/content':           { eyebrow: 'Brand health', icon: FileText },
  '/dashboard/funnel':            { eyebrow: 'Brand health', icon: FunnelIcon },

  /* Intelligence — what is happening in the market? */
  '/dashboard/competitive':       { eyebrow: 'Intelligence', icon: Trophy },
  '/dashboard/marketplace':       { eyebrow: 'Intelligence', icon: MarketIcon },
  '/dashboard/cultural':          { eyebrow: 'Intelligence', icon: Globe },
  '/dashboard/field-intelligence':{ eyebrow: 'Intelligence', icon: FieldIcon },
  '/dashboard/pr':                { eyebrow: 'Intelligence', icon: FileSearch },
  '/dashboard/youtube':           { eyebrow: 'Intelligence', icon: Video },
  '/dashboard/ai-visibility':     { eyebrow: 'Intelligence', icon: Eye },

  /* Campaigns — what am I running? */
  '/dashboard/campaigns':         { eyebrow: 'Campaigns', icon: Megaphone },
  '/dashboard/digital':           { eyebrow: 'Campaigns', icon: Monitor },
  '/dashboard/influencers':       { eyebrow: 'Campaigns', icon: Users },
  '/dashboard/ooh':               { eyebrow: 'Campaigns', icon: OohIcon },
  '/dashboard/events':            { eyebrow: 'Campaigns', icon: CalendarDays },
  '/dashboard/radio':             { eyebrow: 'Campaigns', icon: Radio },
  '/dashboard/tv':                { eyebrow: 'Campaigns', icon: Tv },
  '/dashboard/print':             { eyebrow: 'Campaigns', icon: Newspaper },
  '/dashboard/whatsapp':          { eyebrow: 'Campaigns', icon: MessageCircle },

  /* Creative lab — what am I saying? */
  '/dashboard/voice-builder':     { eyebrow: 'Creative lab', icon: Sparkles },
  '/dashboard/pre-post':          { eyebrow: 'Creative lab', icon: PrePost },
  '/dashboard/creative':          { eyebrow: 'Creative lab', icon: CreativeIcon },
  '/dashboard/creative-library':  { eyebrow: 'Creative lab', icon: BookOpen },
  '/dashboard/creative-fatigue':  { eyebrow: 'Creative lab', icon: AlertTriangle },
  '/dashboard/experiments':       { eyebrow: 'Creative lab', icon: FlaskConical },

  /* Research — what do customers tell me? */
  '/dashboard/surveys':           { eyebrow: 'Research', icon: SurveyIcon },
  '/dashboard/surveys/nps':       { eyebrow: 'Research', icon: TrendingUp },
  '/dashboard/surveys/panels':    { eyebrow: 'Research', icon: ClipboardCheck },

  /* Measurement — is it working? */
  '/dashboard/mmm':               { eyebrow: 'Measurement', icon: ShareIcon },
  '/dashboard/geo-lift':          { eyebrow: 'Measurement', icon: Target },
  '/dashboard/budget':            { eyebrow: 'Measurement', icon: DollarSign },

  /* Growth — how do I keep and grow my base? */
  '/dashboard/retention':         { eyebrow: 'Growth', icon: AlertTriangle },
  '/dashboard/loyalty':           { eyebrow: 'Growth', icon: Gift },
  '/dashboard/advocacy':          { eyebrow: 'Growth', icon: Heart },
  '/dashboard/cdp':               { eyebrow: 'Growth', icon: Database },

  /* Reports — how do I present results? */
  '/dashboard/board-pack':        { eyebrow: 'Reports', icon: FileDown },
  '/dashboard/business-case':     { eyebrow: 'Reports', icon: BarChart3 },
  '/dashboard/methodology':       { eyebrow: 'Reports', icon: BookOpen },

  /* Setup — connect and configure */
  '/dashboard/connectors':        { eyebrow: 'Setup', icon: Plug },
  '/dashboard/settings':          { eyebrow: 'Setup', icon: Settings },
}

/** The section and glyph for a route, or undefined for pages outside the nav. */
export function pageMeta(route: string): PageMeta | undefined {
  return PAGE_META[route]
}
