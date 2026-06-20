import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Map brand category strings → sector_benchmarks sector keys
const SECTOR_MAP: Record<string, string> = {
  'fmcg':                   'FMCG',
  'consumer goods':         'FMCG',
  'consumer packaged goods':'FMCG',
  'fintech':                'Fintech',
  'financial services':     'Fintech',
  'banking':                'Fintech',
  'finance':                'Fintech',
  'telecommunications':     'Telecommunications',
  'telecom':                'Telecommunications',
  'telco':                  'Telecommunications',
  'entertainment':          'Entertainment',
  'media':                  'Entertainment',
  'entertainment & media':  'Entertainment',
  'music':                  'Entertainment',
  'e-commerce':             'E-commerce',
  'ecommerce':              'E-commerce',
  'retail':                 'E-commerce',
  'fashion':                'Fashion',
  'lifestyle':              'Fashion',
  'fashion & lifestyle':    'Fashion',
  'food & beverage':        'Food & Beverage',
  'food and beverage':      'Food & Beverage',
  'food':                   'Food & Beverage',
  'beverage':               'Food & Beverage',
  'restaurant':             'Food & Beverage',
  'qsr':                    'Food & Beverage',
  'healthcare':             'Healthcare',
  'pharma':                 'Healthcare',
  'health':                 'Healthcare',
  'technology':             'Technology',
  'tech':                   'Technology',
  'software':               'Technology',
  'saas':                   'Technology',
  'real estate':            'Real Estate',
  'property':               'Real Estate',
}

function resolveSector(category: string | null): string {
  if (!category) return 'FMCG'
  const lower = category.toLowerCase().trim()
  return SECTOR_MAP[lower] ?? 'FMCG'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: brand } = await supabase.from('brands').select('category').limit(1).single()
  const sector = resolveSector(brand?.category ?? null)

  const { data: benchmarks } = await supabase
    .from('sector_benchmarks')
    .select('metric, p25, p50, p75, top_decile')
    .eq('sector', sector)

  const result: Record<string, { p25: number | null; p50: number | null; p75: number | null; top_decile: number | null }> = {}
  for (const b of (benchmarks ?? [])) {
    result[b.metric] = { p25: b.p25, p50: b.p50, p75: b.p75, top_decile: b.top_decile }
  }

  return NextResponse.json({ sector, benchmarks: result })
}
