import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CampaignDetailClient } from './campaign-detail-client'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ campaignId: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { campaignId } = await params
  const sp = await searchParams
  const days = Math.min(180, Math.max(7, Number(sp.days ?? 30)))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, category')
    .limit(1)
    .single()
  if (!brand) redirect('/onboarding')

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const [{ data: rows }, { data: targets }] = await Promise.all([
    supabase
      .from('digital_performance_daily')
      .select('date, spend, impressions, reach, clicks, ctr, cpm, cpc, cpa, roas, frequency, video_views, video_view_rate, conversions, objective, actions, campaign_name, platform')
      .eq('brand_id', brand.id)
      .eq('campaign_id', campaignId)
      .gte('date', cutoffStr)
      .order('date', { ascending: true }),
    supabase
      .from('campaign_targets')
      .select('*')
      .eq('brand_id', brand.id)
      .eq('platform_campaign_id', campaignId)
      .order('created_at', { ascending: true }),
  ])

  if (!rows || rows.length === 0) notFound()

  const campaignName = rows[0]?.campaign_name ?? campaignId
  const platform     = rows[0]?.platform ?? 'meta'
  const objective    = rows[0]?.objective ?? null

  return (
    <CampaignDetailClient
      campaignId={campaignId}
      campaignName={campaignName}
      platform={platform}
      objective={objective}
      days={days}
      rows={rows}
      initialTargets={targets ?? []}
      industry={brand.category ?? null}
    />
  )
}
