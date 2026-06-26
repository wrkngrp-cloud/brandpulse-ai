import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { inngest } from '@/lib/inngest/client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 400 })

  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 503 })
  }

  const body = await req.json() as {
    name: string
    objective: string
    template_name: string
    template_language: string
    template_vars?: Record<string, string>
  }

  const { name, objective, template_name, template_language, template_vars } = body
  if (!name || !template_name) {
    return NextResponse.json({ error: 'name and template_name required' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Count opted-in contacts for this brand
  const { count } = await service
    .from('whatsapp_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('whatsapp_opted_in', true)

  if (!count || count === 0) {
    return NextResponse.json({ error: 'No opted-in contacts. Import a contact list first.' }, { status: 400 })
  }

  // Create the campaign record
  const { data: campaign, error } = await service
    .from('whatsapp_campaigns')
    .insert({
      brand_id: brandId,
      name,
      objective: objective ?? 'broadcast',
      template_name,
      template_language: template_language ?? 'en',
      template_vars: template_vars ?? null,
      list_size: count,
      status: 'sending',
      scheduled_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !campaign) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create campaign' }, { status: 500 })
  }

  // Trigger Inngest broadcast job
  await inngest.send({
    name: 'whatsapp/broadcast.send',
    data: { campaignId: campaign.id, brandId },
  })

  return NextResponse.json({ campaignId: campaign.id, listSize: count })
}
