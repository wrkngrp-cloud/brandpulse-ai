import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'
import { callAi, extractJson } from '@/lib/ai/client'
import { recordEvent } from '@/lib/tools/events'

export const runtime = 'nodejs'
export const maxDuration = 45

const Body = z.object({ moveId: z.string().uuid() })

/**
 * What one competitor move means for this brand, asked for on demand.
 *
 * The weekly check stores press stories unread, because running the model over
 * every headline for every watched competitor every Monday is the cost shape
 * that gets a free feature switched off. The reading is generated for the
 * stories a marketer actually opens, and then cached on the row so a second
 * open is free.
 *
 * Both reads and the write go through the RLS client, so the move has to
 * belong to the caller's brand for any of this to touch it.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string; name: string; category: string | null; brand_type: string | null }>(
    supabase, 'id, name, category, brand_type',
  )
  if (!brand) return NextResponse.json({ error: 'No active brand.' }, { status: 400 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  const { data: move } = await supabase
    .from('competitor_moves')
    .select('id, competitor_name, category, headline, quote, source_url, published_at, significance, implication')
    .eq('id', parsed.data.moveId)
    .eq('brand_id', brand.id)
    .maybeSingle()

  if (!move) return NextResponse.json({ error: 'That development is not yours.' }, { status: 404 })

  // Already read. Hand it back rather than paying for it twice.
  if (move.significance && move.implication) {
    return NextResponse.json({ significance: move.significance, implication: move.implication, cached: true })
  }

  const system = `You are a competitive intelligence analyst briefing the marketing team at a ${brand.brand_type ?? 'consumer'} brand in Nigeria. You are given one development about a competitor, with the source headline and extract. Say what it means and what the brand should consider doing.

Rules:
- Work only from the headline and extract given. Never state a figure, a market share, a revenue number or a customer count that is not in them.
- If the extract is too thin to support a reading, say so in "significance" and keep "implication" to the one thing worth checking.
- Plain English, active voice, two or three sentences each. No em dashes. Never use the words delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless or tapestry.

Return ONLY JSON: {"significance":"","implication":""}`

  const user_msg = `Our brand: ${brand.name}${brand.category ? ` (${brand.category})` : ''}
Competitor: ${move.competitor_name}
Category of development: ${move.category}
Published: ${move.published_at ?? 'undated'}
Headline: ${move.headline}
Source extract: ${move.quote ?? '(none captured)'}`

  let read: { significance?: string; implication?: string }
  try {
    const raw = await callAi({
      tier: 'structural',
      system,
      messages: [{ role: 'user', content: user_msg }],
      maxTokens: 700,
    })
    read = extractJson<{ significance?: string; implication?: string }>(raw)
  } catch (err) {
    console.error('[watchlist] implication failed:', err)
    return NextResponse.json({ error: 'We could not read that one just now. Try again in a moment.' }, { status: 502 })
  }

  const significance = (read.significance ?? '').trim()
  const implication  = (read.implication ?? '').trim()
  if (!significance) {
    return NextResponse.json({ error: 'We could not read that one just now. Try again in a moment.' }, { status: 502 })
  }

  await supabase.from('competitor_moves')
    .update({ significance, implication })
    .eq('id', move.id)
    .eq('brand_id', brand.id)

  await recordEvent({
    event: 'beta_feature_used', toolId: 'competitor-tracker', userId: user.id,
    props: { feature: 'implication_read' },
  })

  return NextResponse.json({ significance, implication, cached: false })
}
