'use client'

import { useState } from 'react'
import {
  Flame, TrendingUp, TrendingDown, Calendar, Sparkles, Loader2,
  AlertTriangle, ChevronRight, ChevronDown, Star, Globe,
} from 'lucide-react'
import { cn, formatPlatformLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TourTrigger } from '@/components/tours/tour-trigger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MomentType = 'Religious' | 'National' | 'Cultural' | 'Seasonal' | 'Sports' | 'Entertainment' | 'Health' | 'Commerce'

interface CulturalMoment {
  name:           string
  date:           string        // YYYY-MM-DD
  type:           MomentType
  brandRelevance: string        // generic description
  tags:           string[]      // audience/category matching
}

interface ActivationIdea {
  title:       string
  description: string
  channel:     string
  effort:      'Low' | 'Medium' | 'High'
}

interface AnalysisRow {
  id:               string
  cultural_score:   number
  created_at:       string
  content_text:     string | null
  platform:         string | null
  funnel_goal:      string | null
  tone_score:       number | null
  engagement_score: number | null
  risk_score:       number | null
}

interface TargetSegment {
  name:       string
  age_range?: string
  income?:    string
  location?:  string
  interests?: string[]
}

interface CulturalProfile {
  community_corporate?: number
  traditional_modern?:  number
  religious_secular?:   number
  mass_premium?:        number
  local_global?:        number
}

interface Props {
  brandName:       string
  category:        string | null
  crsScore:        number | null
  drift:           number | null
  emotionResonance:number | null
  today:           string
  analysisCount:   number
  brandValues:     string[]
  analyses:        AnalysisRow[]
  targetSegments:  TargetSegment[]
  culturalProfile: CulturalProfile
  brandVoice:      Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Full cultural calendar — Nigerian, African, and global moments
// ---------------------------------------------------------------------------

type BaseMoment = Omit<CulturalMoment, 'date'> & {
  mmdd:           string
  floatingDates?: Record<string, string>
}

const BASE_CALENDAR: BaseMoment[] = [
  // ── Sports ──────────────────────────────────────────────────────────────
  {
    name: 'FIFA World Cup 2026 — Kickoff', mmdd: '06-11', type: 'Sports',
    brandRelevance: 'Biggest sporting event on earth — 48 teams including Nigeria. Watch parties, street activations, and themed content across all demographics',
    tags: ['sports', 'youth', 'male', 'all', 'food', 'beverage', 'entertainment'],
    floatingDates: { '2026': '2026-06-11' },
  },
  {
    name: 'FIFA World Cup 2026 — Final', mmdd: '07-19', type: 'Sports',
    brandRelevance: 'World Cup Final watch parties drive peak F&B and lifestyle spend. Nigeria fans celebrate regardless of who plays',
    tags: ['sports', 'youth', 'male', 'all', 'food', 'beverage'],
    floatingDates: { '2026': '2026-07-19' },
  },
  {
    name: 'Premier League Season Start', mmdd: '08-16', type: 'Sports',
    brandRelevance: 'EPL is Nigeria\'s second religion — viewing parties and fan activations from August through May',
    tags: ['sports', 'youth', 'male', 'urban', 'food', 'beverage'],
  },
  {
    name: 'UEFA Champions League Final', mmdd: '05-30', type: 'Sports',
    brandRelevance: 'UCL Final unites football fans across Nigeria — screen-viewing events in Lagos, Abuja, and PH',
    tags: ['sports', 'youth', 'male', 'urban', 'food', 'beverage'],
  },
  {
    name: 'Lagos Marathon', mmdd: '02-07', type: 'Sports',
    brandRelevance: 'Nigeria\'s largest road race — 50,000+ participants. Health, fitness, hydration, and apparel brands take centre stage',
    tags: ['sports', 'health', 'fitness', 'female', 'urban', 'lagos', 'fmcg'],
  },
  {
    name: 'NBA Africa Game', mmdd: '08-08', type: 'Sports',
    brandRelevance: 'Growing NBA × Afrobeats × Nigerian identity crossover — powerful youth and fashion activation',
    tags: ['sports', 'youth', 'male', 'fashion', 'culture', 'urban'],
  },
  {
    name: 'AFCON 2027', mmdd: '01-10', type: 'Sports',
    brandRelevance: 'Africa Cup of Nations — peak Super Eagles patriotism. Brands that show up for Nigeria during AFCON earn lasting loyalty',
    tags: ['sports', 'all', 'patriotic', 'community', 'male', 'youth'],
    floatingDates: { '2027': '2027-01-10' },
  },

  // ── Nigerian Cultural ────────────────────────────────────────────────────
  {
    name: 'Ojude Oba Festival', mmdd: '05-30', type: 'Cultural',
    brandRelevance: 'Ijebu-Ode\'s royal durbar — spectacular fashion, horsemanship, and Yoruba heritage. Premium brand and influencer moment',
    tags: ['culture', 'fashion', 'premium', 'southwest', 'muslim', 'yoruba', 'food'],
    floatingDates: { '2026': '2026-05-30', '2027': '2027-05-19', '2028': '2028-05-07' },
  },
  {
    name: 'New Yam Festival (Iriji)', mmdd: '08-20', type: 'Cultural',
    brandRelevance: 'Igbo harvest celebration — food, music, and community across Southeast Nigeria and diaspora',
    tags: ['culture', 'food', 'community', 'southeast', 'igbo', 'traditional', 'fmcg'],
  },
  {
    name: 'Eyo Festival', mmdd: '05-02', type: 'Cultural',
    brandRelevance: 'Lagos Island\'s iconic masquerade — white-clad Eyo fill Lagos streets. Tourism, fashion, and premium brands resonate',
    tags: ['culture', 'fashion', 'premium', 'lagos', 'yoruba', 'tourism'],
  },
  {
    name: 'Argungu Fishing Festival', mmdd: '03-14', type: 'Cultural',
    brandRelevance: 'Kebbi State\'s centuries-old fishing festival — powerful northern Nigeria mass-market moment',
    tags: ['culture', 'north', 'hausa', 'community', 'rural', 'mass', 'fmcg'],
  },
  {
    name: 'Durbar Festival', mmdd: '03-20', type: 'Cultural',
    brandRelevance: 'Royal Durbar at Eid — thousands of horsemen in ceremonial dress across Kano, Zaria, Sokoto. Premium northern storytelling moment',
    tags: ['culture', 'fashion', 'premium', 'north', 'hausa', 'muslim', 'traditional'],
    floatingDates: { '2026': '2026-03-20', '2027': '2027-03-09', '2028': '2028-02-27' },
  },
  {
    name: 'Calabar Carnival', mmdd: '12-01', type: 'Cultural',
    brandRelevance: 'Africa\'s biggest street party — one month of parades, floats, and colour in Cross River State. Huge youth activation window',
    tags: ['culture', 'youth', 'entertainment', 'south', 'tourism', 'fashion', 'food'],
  },
  {
    name: 'Ake Arts and Book Festival', mmdd: '10-27', type: 'Cultural',
    brandRelevance: 'West Africa\'s premier literary festival in Abeokuta — premium, educated, diaspora audience',
    tags: ['culture', 'premium', 'educated', 'diaspora', 'female', 'southwest'],
  },
  {
    name: 'Felabration', mmdd: '10-15', type: 'Entertainment',
    brandRelevance: 'Week-long Fela anniversary at Afrika Shrine — counterculture, Afrobeats, and progressive Nigerian identity',
    tags: ['music', 'youth', 'culture', 'afrobeats', 'urban', 'activist', 'lagos'],
  },
  {
    name: 'Gidi Culture Festival', mmdd: '04-18', type: 'Entertainment',
    brandRelevance: 'Lagos\'s outdoor festival of music, art, and culture — premium youth activation in Eko Atlantic area',
    tags: ['music', 'youth', 'fashion', 'urban', 'premium', 'lagos', 'entertainment'],
  },

  // ── Entertainment / Awards ───────────────────────────────────────────────
  {
    name: 'AMVCA (Africa Magic Viewers\' Choice)', mmdd: '03-22', type: 'Entertainment',
    brandRelevance: 'Nigeria\'s biggest TV awards night — Nollywood fans, premium lifestyle consumers, and fashion moment',
    tags: ['entertainment', 'fashion', 'premium', 'female', 'nollywood', 'urban'],
  },
  {
    name: 'Headies Awards', mmdd: '10-25', type: 'Entertainment',
    brandRelevance: 'Afrobeats\' biggest night — massive youth engagement and influencer amplification',
    tags: ['music', 'afrobeats', 'youth', 'fashion', 'urban', 'entertainment'],
  },
  {
    name: 'Afro Nation Portugal', mmdd: '07-03', type: 'Entertainment',
    brandRelevance: 'World\'s largest Afrobeats festival — strong diaspora and international audience for premium Nigerian brands',
    tags: ['music', 'afrobeats', 'diaspora', 'youth', 'premium', 'fashion'],
  },
  {
    name: 'ONE Africa Music Fest', mmdd: '11-07', type: 'Entertainment',
    brandRelevance: 'Pan-African music festival spotlighting Afropop — high-income urban youth audience',
    tags: ['music', 'youth', 'premium', 'urban', 'afrobeats', 'entertainment'],
  },

  // ── Global Cultural ──────────────────────────────────────────────────────
  {
    name: "International Women's Day", mmdd: '03-08', type: 'Cultural',
    brandRelevance: 'Powerful moment for brands to celebrate female consumers and gender equity — campaigns that feel genuine earn high loyalty',
    tags: ['female', 'urban', 'educated', 'premium', 'all', 'health'],
  },
  {
    name: 'World Music Day', mmdd: '06-21', type: 'Cultural',
    brandRelevance: 'Global celebration of music — especially resonant for youth-facing, entertainment, and F&B brands in Nigeria',
    tags: ['music', 'youth', 'urban', 'afrobeats', 'entertainment', 'food'],
  },
  {
    name: 'World Jollof Day', mmdd: '08-22', type: 'Cultural',
    brandRelevance: 'Created to celebrate West African jollof rice — massive organic social moment. Direct brand moment for food companies',
    tags: ['food', 'fmcg', 'all', 'diaspora', 'culture', 'social_media'],
  },
  {
    name: 'Earth Day', mmdd: '04-22', type: 'Cultural',
    brandRelevance: 'Sustainability storytelling — growing relevance with educated urban Nigerian millennials and premium consumers',
    tags: ['educated', 'premium', 'urban', 'youth', 'health', 'tech'],
  },
  {
    name: 'World Food Day', mmdd: '10-16', type: 'Health',
    brandRelevance: 'UN-backed day on food security — natural platform for FMCG and food brands to lead conversations in Nigeria',
    tags: ['food', 'fmcg', 'health', 'community', 'educated'],
  },
  {
    name: "Mother's Day", mmdd: '05-11', type: 'Cultural',
    brandRelevance: 'Strong gifting and celebration moment across all demographics — one of Nigeria\'s highest-engagement social media dates',
    tags: ['female', 'family', 'all', 'premium', 'gifting', 'fmcg', 'food'],
  },
  {
    name: "Father's Day", mmdd: '06-22', type: 'Cultural',
    brandRelevance: 'Growing occasion in urban Nigeria — fashion, electronics, and F&B brands activate strongly',
    tags: ['male', 'family', 'urban', 'premium', 'gifting', 'fashion', 'food'],
  },
  {
    name: "Valentine's Day", mmdd: '02-14', type: 'Cultural',
    brandRelevance: 'High gifting and affinity moment — restaurants, fashion, FMCG, and experience brands all activate',
    tags: ['youth', 'urban', 'couple', 'gifting', 'food', 'fashion', 'premium'],
  },
  {
    name: 'World Environment Day', mmdd: '06-05', type: 'Cultural',
    brandRelevance: 'Brands with a sustainability or community angle can lead conversations and earn goodwill',
    tags: ['educated', 'premium', 'youth', 'urban', 'community', 'health'],
  },

  // ── Religious ───────────────────────────────────────────────────────────
  {
    name: 'Ramadan Start', mmdd: '02-18', type: 'Religious',
    brandRelevance: 'Reach Muslim consumers with values-led, community, and Sahur/Iftar-themed content',
    tags: ['muslim', 'north', 'hausa', 'yoruba', 'community', 'food', 'fmcg', 'religious'],
    floatingDates: { '2026': '2026-02-18', '2027': '2027-02-08', '2028': '2028-01-28' },
  },
  {
    name: 'Easter', mmdd: '04-05', type: 'Religious',
    brandRelevance: 'Family gatherings drive food and gifting spend — strong moment for FMCG, travel, and celebration brands',
    tags: ['christian', 'south', 'east', 'family', 'food', 'gifting', 'all'],
    floatingDates: { '2026': '2026-04-05', '2027': '2027-03-28', '2028': '2028-04-16' },
  },
  {
    name: 'Eid al-Fitr', mmdd: '03-20', type: 'Religious',
    brandRelevance: 'End of Ramadan celebration — gifting, fashion, and premium experiences resonate with Muslim consumers',
    tags: ['muslim', 'north', 'hausa', 'yoruba', 'family', 'fashion', 'food', 'premium', 'gifting'],
    floatingDates: { '2026': '2026-03-20', '2027': '2027-03-09', '2028': '2028-02-27' },
  },
  {
    name: 'Eid al-Adha (Sallah)', mmdd: '05-27', type: 'Religious',
    brandRelevance: 'Themes of sacrifice, generosity, and community — food and lifestyle brands create lasting impressions',
    tags: ['muslim', 'north', 'hausa', 'community', 'food', 'family', 'religious'],
    floatingDates: { '2026': '2026-05-27', '2027': '2027-05-16', '2028': '2028-05-05' },
  },
  {
    name: 'Christmas', mmdd: '12-25', type: 'Religious',
    brandRelevance: 'Peak gifting, family, and celebration campaigns — Nigeria\'s biggest commercial season alongside Detty December',
    tags: ['christian', 'family', 'all', 'gifting', 'food', 'fashion', 'premium'],
  },

  // ── National ─────────────────────────────────────────────────────────────
  {
    name: "Workers' Day", mmdd: '05-01', type: 'National',
    brandRelevance: 'Opportunity to celebrate your workforce, community, and everyday Nigerians',
    tags: ['all', 'community', 'mass', 'family'],
  },
  {
    name: 'Democracy Day', mmdd: '06-12', type: 'National',
    brandRelevance: 'June 12 marks Nigerian democracy — growing civic pride moment among urban educated millennials',
    tags: ['youth', 'urban', 'educated', 'community', 'patriotic'],
  },
  {
    name: 'Africa Day', mmdd: '05-25', type: 'National',
    brandRelevance: 'Pan-African identity and pride — strong cultural storytelling for youth-facing and premium brands',
    tags: ['pan_african', 'diaspora', 'educated', 'youth', 'culture', 'premium'],
  },
  {
    name: 'Independence Day', mmdd: '10-01', type: 'National',
    brandRelevance: 'National pride moment — connect brand to Nigerian identity and community values',
    tags: ['all', 'patriotic', 'community', 'national', 'family', 'food'],
  },

  // ── Seasonal / Commerce ─────────────────────────────────────────────────
  {
    name: 'Back to School', mmdd: '09-07', type: 'Commerce',
    brandRelevance: 'Nigeria\'s biggest retail surge outside Q4 — stationery, uniforms, food, and tech brands all compete for family spend',
    tags: ['family', 'parent', 'youth', 'fmcg', 'food', 'tech', 'education'],
  },
  {
    name: 'Black Friday', mmdd: '11-27', type: 'Commerce',
    brandRelevance: 'Nigeria\'s fastest-growing commerce day — digital and physical retail see massive conversion uplift',
    tags: ['youth', 'urban', 'value_seeker', 'fmcg', 'fashion', 'tech', 'all'],
  },
  {
    name: 'Detty December', mmdd: '12-01', type: 'Seasonal',
    brandRelevance: 'Biggest entertainment and spending season in West Africa — diaspora returns, budgets loosen, every brand competes for share of wallet',
    tags: ['entertainment', 'diaspora', 'youth', 'premium', 'music', 'food', 'fashion', 'lagos'],
  },
  {
    name: 'End of Year Campaign Season', mmdd: '11-01', type: 'Commerce',
    brandRelevance: 'Brands that launch November 1 own the full holiday season — budget-setting and gifting decisions start here',
    tags: ['all', 'fmcg', 'premium', 'fashion', 'food', 'gifting'],
  },

  // ── Health ───────────────────────────────────────────────────────────────
  {
    name: 'Breast Cancer Awareness Month', mmdd: '10-01', type: 'Health',
    brandRelevance: 'Pink October drives deep engagement with female consumers — brands that show up authentically earn long-term loyalty',
    tags: ['female', 'health', 'educated', 'premium', 'urban', 'community'],
  },
  {
    name: 'World Diabetes Day', mmdd: '11-14', type: 'Health',
    brandRelevance: 'Rising diabetes rates in Nigeria make this a high-value health education moment — food and FMCG brands can lead',
    tags: ['health', 'food', 'fmcg', 'educated', 'older', 'family'],
  },
  {
    name: 'World Mental Health Day', mmdd: '10-10', type: 'Health',
    brandRelevance: 'Growing mental health conversation in Nigeria — brands that acknowledge it authentically build deep loyalty with millennials',
    tags: ['youth', 'urban', 'educated', 'health', 'premium', 'female'],
  },
]

// ---------------------------------------------------------------------------
// Calendar builder
// ---------------------------------------------------------------------------

function buildCalendar(today: string): CulturalMoment[] {
  const currentYear = new Date(today).getFullYear()
  const moments: CulturalMoment[] = []
  for (const yr of [currentYear, currentYear + 1, currentYear + 2]) {
    for (const base of BASE_CALENDAR) {
      const date = base.floatingDates?.[String(yr)] ?? `${yr}-${base.mmdd}`
      moments.push({ name: base.name, date, type: base.type, brandRelevance: base.brandRelevance, tags: base.tags })
    }
  }
  return moments
    .filter(m => m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((m, i, arr) => i === 0 || arr[i - 1].name !== m.name)
}

// ---------------------------------------------------------------------------
// Relevance scoring
// ---------------------------------------------------------------------------

const CATEGORY_TAGS: Record<string, string[]> = {
  'Food & Beverages': ['food', 'fmcg', 'beverage'],
  'FMCG':            ['fmcg', 'food', 'mass'],
  'Fashion':         ['fashion', 'premium', 'female'],
  'Technology':      ['tech', 'urban', 'educated'],
  'Health':          ['health', 'fmcg', 'female'],
  'Finance':         ['premium', 'educated', 'urban'],
  'Entertainment':   ['music', 'entertainment', 'youth'],
  'Retail':          ['all', 'fmcg', 'gifting'],
  'Automotive':      ['premium', 'male', 'urban'],
  'Telecom':         ['all', 'tech', 'urban'],
  'Hospitality':     ['premium', 'tourism', 'food'],
  'Media':           ['entertainment', 'youth', 'urban'],
}

function extractAudienceTags(segments: TargetSegment[], culturalProfile: CulturalProfile): Set<string> {
  const tags = new Set<string>()

  for (const seg of segments) {
    const loc = (seg.location ?? '').toLowerCase()
    if (loc.includes('lagos'))                         { tags.add('lagos'); tags.add('urban') }
    if (loc.includes('abuja'))                         { tags.add('urban') }
    if (loc.includes('north'))                         { tags.add('north'); tags.add('hausa'); tags.add('muslim') }
    if (loc.includes('uk') || loc.includes('us') || loc.includes('ca') || loc.includes('diaspora'))
                                                       { tags.add('diaspora') }
    if (loc.includes('south') || loc.includes('east') || loc.includes('igbo'))
                                                       { tags.add('southeast'); tags.add('igbo'); tags.add('christian') }
    if (loc.includes('southwest') || loc.includes('yoruba'))
                                                       { tags.add('southwest'); tags.add('yoruba') }

    const income = (seg.income ?? '').toLowerCase()
    if (income.includes('high') || income.includes('premium')) { tags.add('premium'); tags.add('diaspora') }
    if (income.includes('low') || income.includes('mass'))     { tags.add('mass'); tags.add('community') }

    const age = seg.age_range ?? ''
    const minAge = parseInt(age.split('-')[0]) || 30
    if (minAge <= 30)  tags.add('youth')
    if (minAge >= 35)  { tags.add('family'); tags.add('older') }
    if (minAge <= 40)  tags.add('urban')

    for (const interest of seg.interests ?? []) {
      tags.add(interest.toLowerCase().replace(/\s+/g, '_'))
    }
  }

  const cp = culturalProfile
  if ((cp.religious_secular ?? 50) < 40)    { tags.add('religious'); tags.add('muslim'); tags.add('christian') }
  if ((cp.traditional_modern ?? 50) < 40)   tags.add('traditional')
  if ((cp.community_corporate ?? 50) < 40)  tags.add('community')
  if ((cp.local_global ?? 50) < 40)         { tags.add('local'); tags.add('patriotic') }
  if ((cp.mass_premium ?? 50) > 60)         tags.add('premium')
  if ((cp.mass_premium ?? 50) < 40)         tags.add('mass')

  return tags
}

function scoreMoment(
  moment: CulturalMoment,
  category: string | null,
  audienceTags: Set<string>,
  categoryTags: Set<string>,
): number {
  let score = 0
  const momentTagSet = new Set(moment.tags)

  if (momentTagSet.has('all')) score += 20

  for (const tag of audienceTags) {
    if (momentTagSet.has(tag)) score += 10
  }
  for (const tag of categoryTags) {
    if (momentTagSet.has(tag)) score += 15
  }

  return Math.min(score, 100)
}

function fitLabel(score: number): 'High fit' | 'Good fit' | 'Monitor' {
  if (score >= 40) return 'High fit'
  if (score >= 20) return 'Good fit'
  return 'Monitor'
}

// ---------------------------------------------------------------------------
// Static helpers
// ---------------------------------------------------------------------------

const TYPE_BADGE: Record<MomentType, string> = {
  Religious:     'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  National:      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Cultural:      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Seasonal:      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Sports:        'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  Entertainment: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  Health:        'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  Commerce:      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
}

const FIT_BADGE: Record<string, string> = {
  'High fit':  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Good fit':  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Monitor':   'bg-muted text-muted-foreground',
}

const EFFORT_BADGE: Record<string, string> = {
  Low:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  High:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

function daysUntil(dateStr: string, todayStr: string): number {
  const diffMs = new Date(dateStr).getTime() - new Date(todayStr).getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function crsColor(score: number): string {
  if (score >= 70) return 'text-green-600'
  if (score >= 50) return 'text-amber-500'
  return 'text-red-500'
}

function crsRingColor(score: number): string {
  if (score >= 70) return 'stroke-green-500'
  if (score >= 50) return 'stroke-amber-400'
  return 'stroke-red-500'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CRSGauge({ score, drift }: { score: number | null; drift: number | null }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const pct = score !== null ? Math.min(100, Math.max(0, score)) / 100 : 0
  const dashOffset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative inline-flex items-center justify-center">
        <svg width="136" height="136" className="-rotate-90">
          <circle cx="68" cy="68" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30" />
          {score !== null && (
            <circle cx="68" cy="68" r={radius} fill="none" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              className={cn('transition-all duration-700', crsRingColor(score))} />
          )}
        </svg>
        <div className="absolute flex flex-col items-center">
          {score !== null ? (
            <>
              <span className={cn('text-4xl font-bold tabular-nums', crsColor(score))}>{Math.round(score)}</span>
              <span className="text-xs text-muted-foreground mt-0.5">/ 100</span>
            </>
          ) : (
            <span className="text-4xl font-bold text-muted-foreground/30">—</span>
          )}
        </div>
      </div>
      {drift !== null && (
        <div className={cn('inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full',
          drift >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                     : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        )}>
          {drift >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {drift >= 0 ? '+' : ''}{drift.toFixed(1)} pts vs prior period
        </div>
      )}
    </div>
  )
}

function EmotionBar({ value }: { value: number | null }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Audience emotional positivity</span>
        <span className="text-sm font-semibold tabular-nums">{value !== null ? `${Math.round(value)}%` : '—'}</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700',
          value === null ? 'w-0' : value >= 60 ? 'bg-green-500' : value >= 40 ? 'bg-amber-400' : 'bg-red-400'
        )} style={{ width: value !== null ? `${Math.min(100, value)}%` : '0%' }} />
      </div>
      <p className="text-xs text-muted-foreground">Based on joy, trust and anticipation signals in recent posts</p>
    </div>
  )
}

// Full calendar row (compact)
function CalendarRow({
  moment, daysAway, fit,
}: {
  moment: CulturalMoment; daysAway: number; fit: ReturnType<typeof fitLabel>
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className="shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-lg bg-muted text-center">
        <span className="text-[10px] text-muted-foreground leading-tight">
          {new Date(moment.date + 'T00:00:00').toLocaleDateString('en-NG', { month: 'short' })}
        </span>
        <span className="text-sm font-bold leading-tight">
          {new Date(moment.date + 'T00:00:00').getDate()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium">{moment.name}</p>
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', TYPE_BADGE[moment.type])}>
            {moment.type}
          </span>
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', FIT_BADGE[fit])}>
            {fit}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{moment.brandRelevance}</p>
      </div>
      <div className="shrink-0 text-right pt-0.5">
        <span className={cn('text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full',
          daysAway <= 14 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          : daysAway <= 30 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
        )}>
          {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway}d`}
        </span>
      </div>
    </div>
  )
}

// Top-pick card with on-demand activation ideas
function TopPickCard({
  moment, daysAway, fit, relevanceReason, brandName, category, brandValues, targetSegments,
}: {
  moment:          CulturalMoment
  daysAway:        number
  fit:             ReturnType<typeof fitLabel>
  relevanceReason: string
  brandName:       string
  category:        string | null
  brandValues:     string[]
  targetSegments:  TargetSegment[]
}) {
  const [ideas, setIdeas] = useState<ActivationIdea[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cultural/activation-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          momentName:     moment.name,
          momentDate:     moment.date,
          brandName,
          category:       category ?? undefined,
          brandValues:    brandValues.length ? brandValues : undefined,
          targetSegments: targetSegments.length ? targetSegments : undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to generate ideas')
      const data = (await res.json()) as { ideas: ActivationIdea[] }
      setIdeas(data.ideas)
    } catch {
      setError('Could not generate ideas right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-xl p-4 bg-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold">{moment.name}</p>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', TYPE_BADGE[moment.type])}>
              {moment.type}
            </span>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', FIT_BADGE[fit])}>
              {fit}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {new Date(moment.date + 'T00:00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}
            <span className={cn('font-medium', daysAway <= 14 ? 'text-red-600' : daysAway <= 30 ? 'text-amber-600' : 'text-muted-foreground')}>
              {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway} days away`}
            </span>
          </p>
        </div>
        {!ideas && (
          <Button size="sm" variant="outline" onClick={generate} disabled={loading} className="shrink-0 h-8 text-xs gap-1">
            {loading ? <><Loader2 className="h-3 w-3 animate-spin" />Thinking</> : <><Sparkles className="h-3 w-3" />Get ideas</>}
          </Button>
        )}
      </div>

      {/* Relevance reasoning */}
      <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-xs text-foreground/70 leading-relaxed">
        {relevanceReason}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {ideas && (
        <div className="space-y-2 pt-1">
          {ideas.map((idea, i) => (
            <div key={i} className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium">{idea.title}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">{idea.channel}</span>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', EFFORT_BADGE[idea.effort] ?? 'bg-muted text-muted-foreground')}>
                    {idea.effort}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{idea.description}</p>
            </div>
          ))}
          <button onClick={() => setIdeas(null)} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 pt-1">
            Regenerate
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CulturalClient({
  brandName, category, crsScore, drift, emotionResonance,
  today, analysisCount, brandValues, analyses,
  targetSegments, culturalProfile,
}: Props) {
  const [crsOpen, setCrsOpen] = useState(false)
  const [showAllCalendar, setShowAllCalendar] = useState(false)

  // Build audience tag set for relevance scoring
  const categoryTagSet = new Set<string>([
    ...(category && CATEGORY_TAGS[category] ? CATEGORY_TAGS[category] : []),
    ...(brandValues.map(v => v.toLowerCase())),
  ])
  const audienceTags = extractAudienceTags(targetSegments, culturalProfile)

  // Score and sort all upcoming moments
  const allUpcoming = buildCalendar(today)
  const calStartYear = new Date(today).getFullYear()
  const calEndYear   = calStartYear + 2
  const scoredMoments = allUpcoming.map(m => ({
    moment: m,
    score:  scoreMoment(m, category, audienceTags, categoryTagSet),
    days:   daysUntil(m.date, today),
  }))

  // Top picks: highest relevance score within next 180 days
  const topPicks = [...scoredMoments]
    .filter(s => s.days <= 180)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  // Build relevance reason for each top pick
  function buildReason(moment: CulturalMoment, score: number): string {
    const matchedAudience: string[] = []
    const matchedCategory: string[] = []
    const momentTagSet = new Set(moment.tags)

    for (const tag of audienceTags) {
      if (momentTagSet.has(tag)) {
        if (tag === 'youth')      matchedAudience.push('younger audiences')
        else if (tag === 'female') matchedAudience.push('female consumers')
        else if (tag === 'male')   matchedAudience.push('male consumers')
        else if (tag === 'north')  matchedAudience.push('northern Nigeria audience')
        else if (tag === 'lagos')  matchedAudience.push('Lagos consumers')
        else if (tag === 'diaspora') matchedAudience.push('diaspora audience')
        else if (tag === 'muslim') matchedAudience.push('Muslim consumers')
        else if (tag === 'christian') matchedAudience.push('Christian consumers')
        else if (tag === 'premium') matchedAudience.push('premium spenders')
        else if (tag === 'community') matchedAudience.push('community-driven segments')
        else if (tag === 'family') matchedAudience.push('family-oriented segments')
        else if (tag === 'urban') matchedAudience.push('urban consumers')
        else if (tag === 'educated') matchedAudience.push('educated audience')
      }
    }
    for (const tag of categoryTagSet) {
      if (momentTagSet.has(tag) && !['all', 'fmcg', 'food', 'fashion', 'tech'].includes(tag) === false) {
        matchedCategory.push(tag)
      }
    }

    const audiencePart = matchedAudience.length
      ? `Aligns with your ${[...new Set(matchedAudience)].slice(0, 3).join(', ')}.`
      : ''
    const relevancePart = moment.brandRelevance
    const fitLabel = score >= 40 ? 'Strong brand-audience fit.' : score >= 20 ? 'Relevant for key segments.' : 'Monitor for cultural context.'

    return [fitLabel, audiencePart, relevancePart].filter(Boolean).join(' ')
  }

  // Calendar display (sorted by date)
  const calendarList = allUpcoming
  const displayedCalendar = showAllCalendar ? calendarList : calendarList.slice(0, 12)

  const showDriftAlert = drift !== null && drift < -5

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Cultural Intelligence</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            How well {brandName} resonates with Nigerian and West African audiences
          </p>
        </div>
        <TourTrigger module="cultural" autoStart />
      </div>

      <div data-tour="cultural-main" className="space-y-6">
      {/* Drift alert */}
      {showDriftAlert && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">
            Cultural drift detected — your content has become less resonant with Nigerian audiences recently.
          </p>
        </div>
      )}

      {/* CRS score */}
      <div className="border rounded-xl p-5 bg-card space-y-2">
        <button
          className={cn('flex items-center justify-between w-full text-left', crsScore !== null && 'cursor-pointer hover:opacity-80 transition-opacity')}
          onClick={() => crsScore !== null && setCrsOpen(o => !o)}
          disabled={crsScore === null}
        >
          <div>
            <p className="text-sm font-medium text-muted-foreground">Cultural Resonance Score</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {analysisCount > 0
                ? `Averaged from ${analysisCount} content ${analysisCount === 1 ? 'analysis' : 'analyses'} in the last 30 days`
                : 'Run Pre-Post analyses to populate this score'}
            </p>
          </div>
          {crsScore !== null && (crsOpen
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <CRSGauge score={crsScore} drift={drift} />

        {crsScore === null && (
          <p className="text-center text-xs text-muted-foreground pb-2">
            Use the Pre-Post widget to analyse content and build your Cultural Resonance Score.
          </p>
        )}

        {crsOpen && analyses.length > 0 && (
          <div className="border-t pt-4 mt-2 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Breakdown — last 30 days</p>
            {analyses.map(a => {
              const date = new Date(a.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
              const preview = a.content_text ? a.content_text.slice(0, 80) + (a.content_text.length > 80 ? '…' : '') : null
              return (
                <div key={a.id} className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {a.platform && <span className="text-[10px] font-medium bg-background border rounded px-1.5 py-0.5">{formatPlatformLabel(a.platform)}</span>}
                      {a.funnel_goal && <span className="text-[10px] text-muted-foreground capitalize">{a.funnel_goal}</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{date}</span>
                  </div>
                  {preview && <p className="text-xs text-muted-foreground leading-snug">{preview}</p>}
                  <div className="flex flex-wrap items-center gap-3 pt-0.5">
                    <span className={cn('text-xs font-semibold tabular-nums', crsColor(a.cultural_score))}>Cultural {Math.round(a.cultural_score)}</span>
                    {a.engagement_score != null && <span className="text-xs text-muted-foreground tabular-nums">Eng {Math.round(a.engagement_score)}</span>}
                    {a.tone_score != null && <span className="text-xs text-muted-foreground tabular-nums">Tone {Math.round(a.tone_score)}</span>}
                    {a.risk_score != null && (
                      <span className={cn('text-xs tabular-nums', a.risk_score > 50 ? 'text-red-500' : a.risk_score > 20 ? 'text-amber-500' : 'text-muted-foreground')}>
                        Risk {Math.round(a.risk_score)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Emotion bar */}
      <div className="border rounded-xl p-5 bg-card">
        <EmotionBar value={emotionResonance} />
      </div>

      {/* ── Top picks for this brand ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-semibold">Top picks for {brandName}</p>
          <span className="hidden sm:inline text-xs text-muted-foreground">— ranked by audience fit, next 6 months</span>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Based on your audience profile
          {targetSegments.length > 0 ? ` (${targetSegments.map(s => s.name).join(', ')})` : ''}
          {category ? ` and category (${category})` : ''}. Click "Get ideas" for a brand-specific activation plan.
        </p>

        {topPicks.map(({ moment, score, days }) => (
          <TopPickCard
            key={moment.name + moment.date}
            moment={moment}
            daysAway={days}
            fit={fitLabel(score)}
            relevanceReason={buildReason(moment, score)}
            brandName={brandName}
            category={category}
            brandValues={brandValues}
            targetSegments={targetSegments}
          />
        ))}
      </div>

      {/* ── Full cultural calendar ─────────────────────────────────────────── */}
      <div className="border rounded-xl p-5 bg-card space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Full Cultural Calendar</p>
            <span className="hidden sm:inline text-xs text-muted-foreground">— Planning calendar covers {calStartYear}–{calEndYear} · {allUpcoming.length} upcoming moments</span>
          </div>
        </div>

        {allUpcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No upcoming moments — check back later.</p>
        ) : (
          <>
            <div>
              {displayedCalendar.map(moment => {
                const s = scoredMoments.find(sm => sm.moment.name === moment.name && sm.moment.date === moment.date)
                const score = s?.score ?? 0
                return (
                  <CalendarRow
                    key={moment.name + moment.date}
                    moment={moment}
                    daysAway={daysUntil(moment.date, today)}
                    fit={fitLabel(score)}
                  />
                )
              })}
            </div>
            {calendarList.length > 12 && (
              <button
                onClick={() => setShowAllCalendar(o => !o)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-2 py-1.5 border rounded-lg transition-colors hover:bg-muted/30"
              >
                {showAllCalendar ? 'Show less' : `Show all ${calendarList.length} moments`}
              </button>
            )}
          </>
        )}
      </div>

      </div>
    </div>
  )
}
