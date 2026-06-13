'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export type EventState = { error?: string; success?: boolean } | null

function generateToken(): string {
  return randomBytes(24).toString('hex')
}

async function getBrandId(): Promise<{ brandId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const service = await createServiceClient()
  const { data: member } = await service
    .from('workspace_members').select('workspace_id').eq('user_id', user.id).single()
  if (!member) return { error: 'Workspace not found.' }

  const { data: brand } = await service
    .from('brands').select('id').eq('workspace_id', member.workspace_id).single()
  if (!brand) return { error: 'Brand not found.' }

  return { brandId: brand.id }
}

// ── E1: Create event ──────────────────────────────────────────────────────────

const ambassadorSchema = z.object({
  name:  z.string().min(1),
  phone: z.string().optional(),
})

const eventSchema = z.object({
  name:                z.string().min(1, 'Event name is required'),
  event_type:          z.string().optional(),
  venue:               z.string().optional(),
  city:                z.string().min(1, 'City is required'),
  state:               z.string().optional(),
  date_start:          z.string().min(1, 'Start date is required'),
  date_end:            z.string().min(1, 'End date is required'),
  hashtags:            z.array(z.string()).default([]),
  expected_attendance: z.number().int().positive().optional(),
  objectives: z.object({
    awareness:     z.string().optional(),
    consideration: z.string().optional(),
    action:        z.string().optional(),
    advocacy:      z.string().optional(),
  }).default({}),
  activation_mechanics: z.array(z.string()).default([]),
  kpi_targets: z.object({
    expected_engaged:        z.number().int().optional(),
    expected_leads:          z.number().int().optional(),
    expected_new_customers:  z.number().int().optional(),
    target_cost_per_lead:    z.number().optional(),
    target_cost_per_customer: z.number().optional(),
  }).default({}),
  budget:             z.number().positive().optional(),
  currency:           z.string().default('NGN'),
  missed_call_number: z.string().optional(),
  ambassadors:        z.array(ambassadorSchema).min(1, 'Add at least one ambassador'),
})

export async function createEvent(_prev: EventState, formData: FormData): Promise<EventState> {
  const result = await getBrandId()
  if ('error' in result) return { error: result.error }

  const payload = formData.get('payload')
  if (!payload || typeof payload !== 'string') return { error: 'Invalid form data.' }

  const parsed = eventSchema.safeParse(JSON.parse(payload))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Validation failed.' }

  const d = parsed.data
  const service = await createServiceClient()

  const { data: event, error: eventErr } = await service.from('events').insert({
    brand_id:             result.brandId,
    name:                 d.name,
    event_type:           d.event_type           ?? null,
    venue:                d.venue                ?? null,
    city:                 d.city,
    state:                d.state                ?? null,
    date_start:           d.date_start,
    date_end:             d.date_end,
    hashtags:             d.hashtags,
    expected_attendance:  d.expected_attendance  ?? null,
    objectives:           d.objectives,
    activation_mechanics: d.activation_mechanics,
    kpi_targets:          d.kpi_targets,
    budget:               d.budget               ?? null,
    currency:             d.currency,
    missed_call_number:   d.missed_call_number   ?? null,
    status:               'planned',
  }).select('id').single()

  if (eventErr || !event) return { error: eventErr?.message ?? 'Failed to create event.' }

  const ambassadorRows = d.ambassadors.map(a => ({
    event_id:      event.id,
    name:          a.name,
    phone:         a.phone ?? null,
    session_token: generateToken(),
  }))

  const { error: ambErr } = await service.from('event_ambassadors').insert(ambassadorRows)
  if (ambErr) return { error: ambErr.message }

  redirect(`/dashboard/events/${event.id}`)
}

// ── Go live ───────────────────────────────────────────────────────────────────

export async function goLive(eventId: string): Promise<EventState> {
  const result = await getBrandId()
  if ('error' in result) return { error: result.error }

  const service = await createServiceClient()
  const { error } = await service.from('events').update({ status: 'live' }).eq('id', eventId)
  if (error) return { error: error.message }

  await inngest.send({ name: 'brandpulse/event.live', data: { eventId } })
  return { success: true }
}

// ── Close event ───────────────────────────────────────────────────────────────

export async function closeEvent(eventId: string): Promise<EventState> {
  const result = await getBrandId()
  if ('error' in result) return { error: result.error }

  const service = await createServiceClient()
  const { error } = await service.from('events').update({ status: 'closed' }).eq('id', eventId)
  if (error) return { error: error.message }

  await inngest.send({ name: 'brandpulse/event.closed', data: { eventId } })
  return { success: true }
}

// ── E5: Submit debrief ────────────────────────────────────────────────────────

const debriefSchema = z.object({
  overall:              z.string().optional(),
  wins:                 z.string().optional(),
  challenges:           z.string().optional(),
  product_feedback:     z.string().optional(),
  competitor_activity:  z.string().optional(),
  follow_up_actions:    z.string().optional(),
  estimated_reach:      z.number().int().optional(),
})

export async function submitDebrief(
  eventId: string,
  _prev:    EventState,
  formData: FormData,
): Promise<EventState> {
  const payload = formData.get('payload')
  if (!payload || typeof payload !== 'string') return { error: 'Invalid form data.' }

  const parsed = debriefSchema.safeParse(JSON.parse(payload))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Validation failed.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const service = await createServiceClient()
  const { error } = await service.from('events').update({ debrief: parsed.data }).eq('id', eventId)
  if (error) return { error: error.message }

  return { success: true }
}

// ── Delete event ─────────────────────────────────────────────────────────────

export async function deleteEvent(eventId: string): Promise<EventState> {
  const result = await getBrandId()
  if ('error' in result) return { error: result.error }

  const service = await createServiceClient()
  const { error } = await service.from('events').delete().eq('id', eventId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/events')
  return { success: true }
}

// ── Add ambassador to existing event ─────────────────────────────────────────

export async function addAmbassador(
  eventId: string,
  name:    string,
  phone?:  string,
): Promise<EventState> {
  const result = await getBrandId()
  if ('error' in result) return { error: result.error }

  const service = await createServiceClient()
  const { error } = await service.from('event_ambassadors').insert({
    event_id:      eventId,
    name:          name.trim(),
    phone:         phone?.trim() ?? null,
    session_token: generateToken(),
  })

  if (error) return { error: error.message }
  return { success: true }
}
