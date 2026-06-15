import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const LABEL_SCORE: Record<string, number> = {
  positive: 82,
  neutral:  50,
  negative: 18,
  mixed:    50,
}

const schema = z.object({
  mentionId:      z.string().uuid(),
  correctedLabel: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  reason:         z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { mentionId, correctedLabel, reason } = parsed.data
  const service = await createServiceClient()

  // Load the mention — RLS ensures the caller owns the brand
  const { data: mention, error: mErr } = await supabase
    .from('mentions')
    .select('id, brand_id, content, sentiment_label, created_at')
    .eq('id', mentionId)
    .single()

  if (mErr || !mention) return NextResponse.json({ error: 'Mention not found' }, { status: 404 })

  const brandId       = mention.brand_id as string
  const originalLabel = mention.sentiment_label as string
  const mentionDay    = (mention.created_at as string).slice(0, 10)
  const newScore      = LABEL_SCORE[correctedLabel] ?? 50

  // 1. Update the mention
  const { error: updateErr } = await service
    .from('mentions')
    .update({ sentiment_label: correctedLabel, sentiment_score: newScore })
    .eq('id', mentionId)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 2. Record the dispute
  await service.from('sentiment_disputes').insert({
    mention_id:      mentionId,
    brand_id:        brandId,
    user_id:         user.id,
    original_label:  originalLabel,
    corrected_label: correctedLabel,
    reason:          reason ?? null,
    status:          'applied',
  })

  // 3. Recompute the sentiment_daily row for that day from all classified mentions
  const { data: dayMentions } = await service
    .from('mentions')
    .select('sentiment_label, sentiment_score')
    .eq('brand_id', brandId)
    .gte('created_at', `${mentionDay}T00:00:00Z`)
    .lt('created_at',  `${mentionDay}T23:59:59Z`)
    .not('sentiment_label', 'is', null)

  if (dayMentions && dayMentions.length > 0) {
    const total    = dayMentions.length
    const pos      = dayMentions.filter(m => m.sentiment_label === 'positive').length
    const neg      = dayMentions.filter(m => m.sentiment_label === 'negative').length
    const neu      = total - pos - neg
    const avgScore = dayMentions.reduce((s, m) => s + (Number(m.sentiment_score) || 50), 0) / total

    await service.from('sentiment_daily').update({
      social_score:  +avgScore.toFixed(1),
      blended_score: +avgScore.toFixed(1),
      positive_pct:  +((pos / total) * 100).toFixed(1),
      negative_pct:  +((neg / total) * 100).toFixed(1),
      neutral_pct:   +((neu / total) * 100).toFixed(1),
    })
    .eq('brand_id', brandId)
    .eq('day', mentionDay)
  }

  return NextResponse.json({
    success:        true,
    correctedLabel,
    sentimentScore: newScore,
    message:        'Dispute applied. Sentiment data updated.',
  })
}
