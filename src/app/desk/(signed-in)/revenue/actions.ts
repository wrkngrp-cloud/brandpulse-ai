'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { z } from 'zod'

export type RevenueActionState = { error?: string; ok?: string } | null

const subscriptionSchema = z.object({
  workspace_id: z.string().uuid('Pick an account'),
  plan:         z.string().min(2).max(40),
  amount_ngn:   z.coerce.number().int().min(0).max(1_000_000_000),
  interval:     z.enum(['month', 'year']),
  status:       z.enum(['trialing', 'active', 'past_due', 'cancelled']),
  period_end:   z.string().optional(),
})

/**
 * Entering a subscription by hand.
 *
 * This is the interim path while billing is deferred, and it says so: the row
 * is stamped `provider: 'manual'` and keeps that stamp. When Paystack is
 * switched on it writes its own rows with its own provider, so the two never
 * get confused for one another and nothing reconciles silently.
 */
export async function saveSubscription(
  _prev: RevenueActionState, formData: FormData,
): Promise<RevenueActionState> {
  const session = await requireStaffOrNull('revenue.edit')
  if (!session) return { error: 'You do not have permission to change revenue.' }

  const parsed = subscriptionSchema.safeParse({
    workspace_id: formData.get('workspace_id'),
    plan:         formData.get('plan'),
    amount_ngn:   formData.get('amount_ngn'),
    interval:     formData.get('interval'),
    status:       formData.get('status'),
    period_end:   formData.get('period_end') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const service = await createServiceClient()

  const { data: workspace } = await service
    .from('workspaces').select('id, name').eq('id', parsed.data.workspace_id).maybeSingle()
  if (!workspace) return { error: 'That account does not exist.' }

  // One manual subscription per account. A second one would double-count in
  // the MRR, so an existing manual row is updated rather than added to.
  const { data: existing } = await service
    .from('subscriptions')
    .select('id')
    .eq('workspace_id', parsed.data.workspace_id)
    .eq('provider', 'manual')
    .maybeSingle()

  const row = {
    workspace_id:        parsed.data.workspace_id,
    plan:                parsed.data.plan,
    amount_ngn:          parsed.data.amount_ngn,
    interval:            parsed.data.interval,
    status:              parsed.data.status,
    provider:            'manual' as const,
    current_period_end:  parsed.data.period_end ?? null,
    created_by:          session.userId,
  }

  const { error } = existing
    ? await service.from('subscriptions').update(row).eq('id', existing.id)
    : await service.from('subscriptions').insert(row)

  if (error) return { error: 'Could not save that subscription.' }

  await writeAudit({
    actorId: session.userId,
    action:  existing ? 'revenue.subscription_updated' : 'revenue.subscription_created',
    targetType: 'workspace', targetId: parsed.data.workspace_id,
    workspaceId: parsed.data.workspace_id,
    summary: `${existing ? 'Updated' : 'Recorded'} a ${parsed.data.plan} subscription for ${workspace.name}`,
    meta: { amount_ngn: parsed.data.amount_ngn, interval: parsed.data.interval, status: parsed.data.status },
  })

  revalidatePath('/desk/revenue')
  return { ok: `Saved ${workspace.name} on ${parsed.data.plan}.` }
}

const invoiceSchema = z.object({
  workspace_id: z.string().uuid('Pick an account'),
  amount_ngn:   z.coerce.number().int().min(1).max(1_000_000_000),
  status:       z.enum(['draft', 'sent', 'paid', 'failed', 'refunded']),
  paid_at:      z.string().optional(),
})

export async function saveInvoice(
  _prev: RevenueActionState, formData: FormData,
): Promise<RevenueActionState> {
  const session = await requireStaffOrNull('revenue.edit')
  if (!session) return { error: 'You do not have permission to change revenue.' }

  const parsed = invoiceSchema.safeParse({
    workspace_id: formData.get('workspace_id'),
    amount_ngn:   formData.get('amount_ngn'),
    status:       formData.get('status'),
    paid_at:      formData.get('paid_at') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const service = await createServiceClient()
  const { data: subscription } = await service
    .from('subscriptions').select('id')
    .eq('workspace_id', parsed.data.workspace_id).eq('provider', 'manual').maybeSingle()

  const { error } = await service.from('invoices').insert({
    workspace_id:    parsed.data.workspace_id,
    subscription_id: subscription?.id ?? null,
    amount_ngn:      parsed.data.amount_ngn,
    status:          parsed.data.status,
    provider:        'manual',
    // A paid invoice with no date is a figure nobody can place in a month, so
    // the date defaults to now rather than staying empty.
    paid_at:         parsed.data.status === 'paid'
      ? (parsed.data.paid_at ? new Date(parsed.data.paid_at).toISOString() : new Date().toISOString())
      : null,
    created_by:      session.userId,
  })
  if (error) return { error: 'Could not save that invoice.' }

  await writeAudit({
    actorId: session.userId, action: 'revenue.invoice_created',
    targetType: 'workspace', targetId: parsed.data.workspace_id,
    workspaceId: parsed.data.workspace_id,
    summary: `Recorded a ${parsed.data.status} invoice`,
    meta: { amount_ngn: parsed.data.amount_ngn },
  })

  revalidatePath('/desk/revenue')
  return { ok: 'Invoice recorded.' }
}
