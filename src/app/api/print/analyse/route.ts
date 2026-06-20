import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { z } from 'zod'

const Body = z.object({
  days:      z.number().int().min(7).max(180).default(30),
  brandName: z.string(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { days, brandName } = parsed.data

  const { data: brand } = await supabase.from('brands').select('id').limit(1).single()
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { data: placements } = await supabase
    .from('print_placements')
    .select('publication_name, position, size, insertions, net_cost, qr_scan_count, status, print_publications(circulation, readership_mult)')
    .eq('brand_id', brand.id)
    .gte('edition_date', cutoff.toISOString().slice(0, 10))

  if (!placements?.length) {
    return NextResponse.json({ error: 'No print placement data for this period.' }, { status: 400 })
  }

  // Aggregate by publication
  const pubMap: Record<string, {
    insertions: number; spend: number; circulation: number; readership: number
    qr_scans: number; positions: Set<string>; sizes: Set<string>
  }> = {}

  for (const p of placements) {
    const pub = p.publication_name
    if (!pubMap[pub]) pubMap[pub] = { insertions: 0, spend: 0, circulation: 0, readership: 0, qr_scans: 0, positions: new Set(), sizes: new Set() }
    pubMap[pub].insertions += p.insertions
    pubMap[pub].spend      += Number(p.net_cost ?? 0)
    pubMap[pub].qr_scans   += p.qr_scan_count ?? 0
    pubMap[pub].positions.add(p.position)
    pubMap[pub].sizes.add(p.size)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pubData = (p as any).print_publications as { circulation: number | null; readership_mult: number | null } | null
    if (pubData?.circulation) {
      const circ = pubData.circulation * p.insertions
      pubMap[pub].circulation += circ
      pubMap[pub].readership  += circ * Number(pubData.readership_mult ?? 4)
    }
  }

  const pubLines = Object.entries(pubMap).map(([name, d]) => {
    const cpt = d.readership > 0 ? `₦${(d.spend / (d.readership / 1000)).toFixed(0)}` : 'n/a'
    const scanRate = d.circulation > 0 ? `${(d.qr_scans / d.circulation * 100).toFixed(3)}%` : 'n/a'
    const costPerScan = d.qr_scans > 0 ? `₦${(d.spend / d.qr_scans).toFixed(0)}` : 'n/a'
    return `${name}: ${d.insertions} insertions, ₦${d.spend.toLocaleString()} spend, est. readership ${(d.readership / 1000).toFixed(0)}K, CPT ${cpt}, QR scans ${d.qr_scans} (scan rate ${scanRate}, cost/scan ${costPerScan}), positions: ${[...d.positions].join('/')}`
  }).join('\n')

  const totalScans = Object.values(pubMap).reduce((s, d) => s + d.qr_scans, 0)
  const totalSpend = Object.values(pubMap).reduce((s, d) => s + d.spend, 0)
  const totalReadership = Object.values(pubMap).reduce((s, d) => s + d.readership, 0)
  const avgScanRate = totalReadership > 0 ? (totalScans / (Object.values(pubMap).reduce((s, d) => s + d.circulation, 0)) * 100).toFixed(3) : '0'

  const text = await callAi({
    tier: 'structural',
    system: `You are a media expert specialising in Nigerian print advertising.
Be specific and actionable. Reference actual publication names from the data.
The Nigerian average QR scan rate for print is 0.3%. Anything above that is strong.
Respond in plain text with section headers using ##. Keep each section to 2-3 sentences.`,
    messages: [{
      role: 'user',
      content: `Analyse this print campaign data for ${brandName} over the last ${days} days.

Total spend: ₦${totalSpend.toLocaleString()}
Total estimated readership: ${(totalReadership / 1000).toFixed(0)}K
Total QR scans: ${totalScans} (avg scan rate: ${avgScanRate}%)
Nigerian average QR scan rate: 0.3%

PUBLICATION PERFORMANCE:
${pubLines}

Provide:
## Publication Reach Efficiency
Rank publications by CPT (cost per thousand readers). Which publications are delivering the best value for ${brandName}?

## QR Attribution Analysis
Which publications are driving the most QR scans? Compare against the 0.3% Nigerian average. What does the scan rate reveal about reader engagement?

## Position and Size Insights
Comment on which positions (Front Page, ROP Interior, etc.) are appearing in the data and whether the creative size choices are appropriate for the intended reach.

## Key Recommendation
One clear, actionable next step — whether to increase spend with top-performing publications, test a new position, or adjust the attribution URL strategy.`,
    }],
    maxTokens: 700,
  })

  return NextResponse.json({ analysis: text })
}
