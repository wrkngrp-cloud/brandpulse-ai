import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const APP_URL = process.env.APP_URL ?? 'https://brandpulse.ai'

const Body = z.object({
  phones: z.array(z.string().min(6)).min(1).max(500),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.AFRICAS_TALKING_API_KEY) {
    return NextResponse.json({ error: 'WhatsApp API not configured. Add AFRICAS_TALKING_API_KEY to environment variables.' }, { status: 503 })
  }

  const { id } = await params
  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { data: survey } = await supabase
    .from('surveys')
    .select('id, name, brand_id')
    .eq('id', id)
    .single()
  if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })

  const { data: brand } = await supabase.from('brands').select('name').eq('id', survey.brand_id).single()
  const brandName = brand?.name ?? 'Us'
  const surveyUrl = `${APP_URL}/survey/${survey.id}`
  const message   = `Hi! ${brandName} would love your feedback on "${survey.name}". It takes less than 2 minutes:\n${surveyUrl}`

  const { phones } = parsed.data
  let sent = 0
  let lastError: string | null = null

  // Send in batches of 20 (AT recommendation)
  for (let i = 0; i < phones.length; i += 20) {
    const batch = phones.slice(i, i + 20)
    try {
      const res = await fetch('https://content.africastalking.com/version1/messaging/whatsapp', {
        method: 'POST',
        headers: {
          'apiKey':       process.env.AFRICAS_TALKING_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: process.env.AFRICAS_TALKING_USERNAME ?? 'sandbox',
          to:       batch,
          message,
          from:     process.env.AFRICAS_TALKING_WHATSAPP_SENDER,
        }),
      })
      if (res.ok) {
        sent += batch.length
      } else {
        const body = await res.json().catch(() => ({}))
        lastError = (body as { errorMessage?: string }).errorMessage ?? `HTTP ${res.status}`
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error'
    }
  }

  if (sent === 0 && lastError) {
    return NextResponse.json({ error: lastError }, { status: 502 })
  }

  return NextResponse.json({ sent, failed: phones.length - sent })
}
