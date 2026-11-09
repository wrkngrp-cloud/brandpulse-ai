import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/client'
import { assistantMode, isWorkingTime, lagosDay, LIMITS, maxPriority, pickPersona, workingMsBetween, isPersona, type Priority } from '@/lib/support/assistant/config'
import { decideTurn, typingDelayMs, type TurnMessage, type TurnContext } from '@/lib/support/assistant/engine'
import { loadBuildPack } from '@/lib/support/assistant/knowledge'
import { notifyStaff } from '@/lib/support/assistant/notify'
import { isOverdue, targetMinutes } from '@/lib/support/reply-targets'
import { SUGGESTION_HEADER, SUGGESTION_NOTES } from '@/lib/support/assistant/suggestion'

/**
 * The support assistant's reply job.
 *
 * Fired by /api/support/message after a customer message is saved, debounced
 * per conversation so a burst gets one reply, and limited to one run per
 * conversation at a time. Everything it decides comes from decideTurn in
 * src/lib/support/assistant/engine.ts; this file only reads the thread and
 * writes the result.
 *
 * Modes (SUPPORT_ASSISTANT_MODE, read on every run, so off is a kill switch):
 *   off      nothing happens
 *   suggest  a draft lands as an internal note headed "Suggested reply" for a
 *            person to send; nothing reaches the customer
 *   live     the reply is posted as author_type 'assistant'
 *
 * Service client throughout, because this is a background job: the
 * conversation id comes from our own event, sent by a route that resolved it
 * from the session or the visitor cookie, never from a request body.
 */


const STEP_HINT = /\b(click|go to|open|try|tap|select|paste|connect|turn on|copy|add|run)\b/i
const NO_NUDGE_AFTER = new Set(['CLS-01', 'CLS-02', 'HUM-01', 'HUM-02', 'TEC-01', 'FBK-01', 'FBK-02', 'SIL-01'])

interface ConvRow {
  id: string
  status: string
  priority: string
  assigned_to: string | null
  user_id: string | null
  workspace_id: string | null
  brand_id: string | null
  email: string | null
  name: string | null
  source: string
  page_url: string | null
  assistant_persona: string | null
  assistant_state: string
  assistant_handoff_at: string | null
  assistant_reply_count: number
  assistant_unhelpful_count: number
  assistant_calls_day: string | null
  assistant_calls_today: number
  assistant_email_asked: boolean
  assistant_nudged_at: string | null
  assistant_chased_at: string | null
  tags: string[] | null
}

const CONV_COLUMNS = 'id, status, priority, assigned_to, user_id, workspace_id, brand_id, email, name, source, page_url, assistant_persona, assistant_state, assistant_handoff_at, assistant_reply_count, assistant_unhelpful_count, assistant_calls_day, assistant_calls_today, assistant_email_asked, assistant_nudged_at, assistant_chased_at, tags'

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function loadThread(conversationId: string) {
  const service = await createServiceClient()
  const { data: conv } = await service
    .from('support_conversations').select(CONV_COLUMNS).eq('id', conversationId).maybeSingle()
  if (!conv) return null

  const { data: rows } = await service
    .from('support_messages')
    .select('id, author_type, body, internal, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at')
    .limit(300)

  return { conv: conv as ConvRow, rows: rows ?? [] }
}

async function contextPacket(conv: ConvRow): Promise<Record<string, string | number | null>> {
  const packet: Record<string, string | number | null> = {
    source: conv.source, page_url: conv.page_url, email: conv.email,
    workspace: null, plan: null, brand: null, brand_type: null, bhi: null,
  }
  if (!conv.workspace_id) return packet
  const service = await createServiceClient()
  const [{ data: ws }, { data: brand }, { data: snap }] = await Promise.all([
    service.from('workspaces').select('name, plan').eq('id', conv.workspace_id).maybeSingle(),
    conv.brand_id
      ? service.from('brands').select('name, brand_type').eq('id', conv.brand_id).maybeSingle()
      : Promise.resolve({ data: null }),
    conv.brand_id
      ? service.from('brand_health_snapshots').select('bhi').eq('brand_id', conv.brand_id)
          .order('snapshot_date', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  packet.workspace  = (ws as { name?: string } | null)?.name ?? null
  packet.plan       = (ws as { plan?: string } | null)?.plan ?? null
  packet.brand      = (brand as { name?: string } | null)?.name ?? null
  packet.brand_type = (brand as { brand_type?: string } | null)?.brand_type ?? null
  const bhi = (snap as { bhi?: number } | null)?.bhi
  packet.bhi = typeof bhi === 'number' ? Math.round(bhi) : null
  return packet
}

export const supportAssistantReply = inngest.createFunction(
  {
    id:   'support-assistant-reply',
    name: 'Support assistant: reply to a customer message',
    triggers: [{ event: 'support/message.received' }],
    debounce:    { key: 'event.data.conversationId', period: LIMITS.debounce },
    concurrency: { key: 'event.data.conversationId', limit: 1 },
    retries: 1,
  },
  async ({ event, step, logger }) => {
    const conversationId = String((event.data as { conversationId?: string }).conversationId ?? '')
    if (!conversationId) return { skipped: 'no conversation id' }

    const mode = assistantMode()
    if (mode === 'off') return { skipped: 'mode off' }

    // ── What is there to answer, and should we? ──────────────────────────────
    const plan = await step.run('load', async () => {
      const loaded = await loadThread(conversationId)
      if (!loaded) return { skip: 'conversation gone' as string }
      const { conv, rows } = loaded

      if (conv.status === 'closed') return { skip: 'closed' }
      if (conv.assigned_to) return { skip: 'assigned to staff' }

      const now = Date.now()
      const staffRecently = rows.some(r => r.author_type === 'staff' && !r.internal
        && now - new Date(r.created_at).getTime() < LIMITS.staffQuietMs)
      if (staffRecently) return { skip: 'staff posted in the last 30 minutes' }

      const visible = rows.filter(r => !r.internal)
      // The answer point: our last visible reply, or in suggest mode our last draft.
      const lastDraft = mode === 'suggest'
        ? [...rows].reverse().find(r => r.internal && r.author_type === 'assistant' && r.body.startsWith(SUGGESTION_HEADER))
        : undefined
      const lastOurs = [...visible].reverse().find(r => r.author_type === 'assistant' || r.author_type === 'staff')
      const cutoff = Math.max(
        lastOurs ? new Date(lastOurs.created_at).getTime() : 0,
        lastDraft ? new Date(lastDraft.created_at).getTime() : 0,
      )
      const pending = visible.filter(r => r.author_type === 'customer' && new Date(r.created_at).getTime() > cutoff)
      if (!pending.length) return { skip: 'nothing new from the customer' }

      return {
        skip: null,
        conv,
        thread: visible.map(r => ({ author: r.author_type, body: r.body, createdAt: r.created_at })) as TurnMessage[],
        pending: pending.map(r => ({ author: 'customer', body: r.body, createdAt: r.created_at })) as TurnMessage[],
        pendingIds: pending.map(r => r.id),
        packet: await contextPacket(conv),
      }
    })
    if (plan.skip || !('conv' in plan) || !plan.conv) return { skipped: plan.skip }
    const { conv, thread, pending, pendingIds, packet } = plan

    // ── A name for the thread, once, in live mode only ───────────────────────
    let persona: string | null = null
    if (mode === 'live') {
      persona = await step.run('persona', async () => {
        if (isPersona(conv.assistant_persona)) return conv.assistant_persona
        const service = await createServiceClient()
        await service.from('support_conversations')
          .update({ assistant_persona: pickPersona() })
          .eq('id', conversationId).is('assistant_persona', null)
        const { data } = await service.from('support_conversations')
          .select('assistant_persona').eq('id', conversationId).maybeSingle()
        return (data?.assistant_persona as string | null) ?? null
      })
    }

    // ── Decide ───────────────────────────────────────────────────────────────
    const today = lagosDay()
    const callsToday = conv.assistant_calls_day === today ? conv.assistant_calls_today : 0
    const now = new Date()

    const decision = await step.run('decide', async () => {
      const ctx: TurnContext = {
        persona, mode,
        signedIn: !!conv.user_id,
        customerName: conv.name,
        hasEmail: !!conv.email,
        emailAsked: conv.assistant_email_asked,
        handedOff: conv.assistant_state === 'handed_off',
        handoffAt: conv.assistant_handoff_at,
        priority: (conv.priority as Priority) ?? 'normal',
        replyCount: conv.assistant_reply_count,
        unhelpfulCount: conv.assistant_unhelpful_count,
        callsToday,
        packet,
        workingHoursNow: isWorkingTime(now),
        workingMsSinceHandoff: conv.assistant_handoff_at ? workingMsBetween(new Date(conv.assistant_handoff_at), now) : 0,
        workingMsSinceChase: conv.assistant_chased_at ? workingMsBetween(new Date(conv.assistant_chased_at), now) : null,
      }
      return decideTurn({
        pack: loadBuildPack(), ctx, thread, pending,
        complete: (system, messages) => callAi({
          tier: 'chat', system, messages, maxTokens: 900, temperature: 0.3,
          meta: {
            workspaceId: conv.workspace_id, brandId: conv.brand_id, userId: conv.user_id,
            feature: 'support.assistant',
          },
        }),
      })
    })

    if (!decision.reply) return { skipped: decision.fallback ?? 'no reply' }

    // A short, length-based pause before a live reply. There is no typing
    // indicator to show (none exists in the widget, and a visitor's widget
    // polls rather than listening on Realtime), so the pause is the whole of it.
    if (mode === 'live') await step.sleep('typing', typingDelayMs(decision.reply))

    // ── Write ────────────────────────────────────────────────────────────────
    const applied = await step.run('apply', async () => {
      const service = await createServiceClient()

      // A person may have stepped in while we were thinking.
      const fresh = await loadThread(conversationId)
      if (!fresh) return { posted: false, why: 'conversation gone' }
      if (fresh.conv.assigned_to || fresh.conv.status === 'closed') return { posted: false, why: 'taken by staff' }
      const cutoff = new Date(pending[pending.length - 1].createdAt).getTime()
      if (fresh.rows.some(r => r.author_type === 'staff' && !r.internal && new Date(r.created_at).getTime() > cutoff)) {
        return { posted: false, why: 'staff replied meanwhile' }
      }

      const isHandoff = decision.action === 'handoff' && conv.assistant_state !== 'handed_off'
      const lead = decision.tags.includes('lead')
      const priority: Priority = decision.chase
        ? (decision.priority ?? maxPriority(conv.priority, 'normal'))
        : isHandoff ? maxPriority(conv.priority, decision.priority ?? 'normal') : (conv.priority as Priority)

      let reply = decision.reply
      if (decision.wantsEmail && !/email/i.test(reply)) {
        reply = `${reply}\n\n${loadBuildPack().macros['HND-08']}`
      }

      if (decision.redact.length) {
        await service.from('support_messages')
          .update({ needs_redaction: true })
          .in('id', decision.redact.map(i => pendingIds[i]))
      }

      const update: Record<string, unknown> = {
        assistant_calls_day: today,
        assistant_calls_today: callsToday + decision.calls,
      }

      if (mode === 'suggest') {
        const notes = [
          decision.action === 'handoff' ? `If sent: hand off, priority ${decision.priority ?? 'normal'}` : null,
          decision.tags.length ? `Tags: ${decision.tags.join(', ')}` : null,
          decision.macroId ? `Macro: ${decision.macroId}` : null,
          decision.redact.length ? 'A customer message holds a secret and is flagged for redaction.' : null,
          decision.fallback ? `Fallback: ${decision.fallback}` : null,
          decision.handoffNote ? `\nHandoff note\n${decision.handoffNote}` : null,
        ].filter(Boolean).join('\n')
        await service.from('support_messages').insert({
          conversation_id: conversationId, author_type: 'assistant', internal: true,
          body: `${SUGGESTION_HEADER}\n\n${reply}${notes ? `\n\n${SUGGESTION_NOTES}\n${notes}` : ''}`,
        })
        await service.from('support_conversations').update(update).eq('id', conversationId)
        return { posted: false, why: 'suggested', handoff: false }
      }

      // Live.
      const { error } = await service.from('support_messages').insert({
        conversation_id: conversationId, author_type: 'assistant', author_id: null, body: reply,
      })
      if (error) throw new Error(`could not post the assistant reply: ${error.message}`)

      const tags = [...new Set([...(fresh.conv.tags ?? []), ...decision.tags])]
      Object.assign(update, {
        assistant_reply_count: fresh.conv.assistant_reply_count + 1,
        assistant_unhelpful_count: fresh.conv.assistant_unhelpful_count + (decision.unhelpful ? 1 : 0),
        tags,
        priority,
      })
      if (decision.wantsEmail) update.assistant_email_asked = true
      if (decision.capturedEmail && !fresh.conv.email && VALID_EMAIL.test(decision.capturedEmail)) {
        update.email = decision.capturedEmail.toLowerCase()
      }
      if (isHandoff) {
        update.assistant_state = 'handed_off'
        update.assistant_handoff_at = new Date().toISOString()
        update.assistant_overdue_notified_at = null
        update.assigned_to = null
      }
      if (decision.chase) update.assistant_chased_at = new Date().toISOString()
      if (decision.macroId === 'CLS-02') {
        update.status = 'closed'
        update.closed_at = new Date().toISOString()
      }
      await service.from('support_conversations').update(update).eq('id', conversationId)

      if (isHandoff && decision.handoffNote) {
        await service.from('support_messages').insert({
          conversation_id: conversationId, author_type: 'assistant', internal: true,
          body: `Handoff from the support assistant\n\n${decision.handoffNote}${decision.fallback ? `\n\nWhy: ${decision.fallback}` : ''}`,
        })
      }
      if (!isHandoff && conv.assistant_state === 'handed_off' && decision.macroId?.startsWith('PND-')) {
        await service.from('support_messages').insert({
          conversation_id: conversationId, author_type: 'assistant', internal: true,
          body: decision.chase
            ? `Customer chased (PND-03). Priority raised to ${priority}. Staff notified again.`
            : `Customer added to the case:\n${pending.map(m => m.body).join('\n')}`.slice(0, 4000),
        })
      }

      let notified: Awaited<ReturnType<typeof notifyStaff>> | null = null
      if (isHandoff || decision.chase) {
        notified = await notifyStaff({
          conversationId, priority,
          topic: decision.handoffNote?.split('\n').find(l => l.startsWith('Topic:'))?.slice(7)
            ?? (decision.chase ? 'The customer is chasing their case.' : 'A case was handed to the team.'),
          reason: decision.chase ? 'chase' : 'handoff',
          lead: lead || (fresh.conv.tags ?? []).includes('lead'),
        })
      }
      return { posted: true, handoff: isHandoff, notified }
    })

    if (applied.posted === false) return { mode, ...applied }

    // ── SIL-01: one check-in after ten quiet minutes following a step ────────
    const nudgeable = mode === 'live'
      && decision.action === 'none'
      && conv.assistant_state !== 'handed_off'
      && !conv.assistant_nudged_at
      && !NO_NUDGE_AFTER.has(decision.macroId ?? '')
      && !decision.macroId?.startsWith('PND-')
      && STEP_HINT.test(decision.reply)

    if (nudgeable) {
      await step.sleep('silence', LIMITS.silenceMs)
      const nudged = await step.run('nudge', async () => {
        if (assistantMode() !== 'live') return 'mode changed'
        const fresh = await loadThread(conversationId)
        if (!fresh) return 'gone'
        const { conv: c, rows } = fresh
        if (c.status === 'closed' || c.assigned_to || c.assistant_state === 'handed_off' || c.assistant_nudged_at) return 'not needed'
        const last = [...rows].reverse().find(r => !r.internal)
        if (!last || last.author_type !== 'assistant') return 'they replied'
        if (Date.now() - new Date(last.created_at).getTime() < LIMITS.silenceMs - 30_000) return 'too soon'
        const service = await createServiceClient()
        const { data: claimed } = await service.from('support_conversations')
          .update({ assistant_nudged_at: new Date().toISOString() })
          .eq('id', conversationId).is('assistant_nudged_at', null)
          .select('id')
        if (!claimed?.length) return 'already nudged'
        await service.from('support_messages').insert({
          conversation_id: conversationId, author_type: 'assistant', body: loadBuildPack().macros['SIL-01'],
        })
        return 'sent'
      })
      logger.info(`support-assistant: SIL-01 ${nudged}`)
    }

    return { mode, ...applied }
  },
)

/**
 * Handed-off cases past their reply target.
 *
 * Every five minutes, inside working hours only (targets count working time),
 * any case with the team and no staff reply since the handoff that has passed
 * its target in src/lib/support/reply-targets.ts notifies staff once more. The
 * Desk inbox marks the same rows as overdue from the same constant.
 */
export const supportAssistantOverdue = inngest.createFunction(
  {
    id:   'support-assistant-overdue',
    name: 'Support assistant: notify staff of overdue cases',
    triggers: [{ cron: 'TZ=Africa/Lagos */5 9-17 * * 1-5' }],
  },
  async ({ step, logger }) => {
    if (assistantMode() === 'off') return { skipped: 'mode off' }

    const count = await step.run('sweep', async () => {
      const service = await createServiceClient()
      const { data } = await service
        .from('support_conversations')
        .select('id, priority, assistant_handoff_at, tags, status')
        .eq('assistant_state', 'handed_off')
        .is('assistant_overdue_notified_at', null)
        .is('assigned_to', null)
        .neq('status', 'closed')
        .not('assistant_handoff_at', 'is', null)
        .limit(200)

      let n = 0
      for (const row of data ?? []) {
        if (!isOverdue(row.priority, row.assistant_handoff_at)) continue
        const { data: claimed } = await service.from('support_conversations')
          .update({ assistant_overdue_notified_at: new Date().toISOString() })
          .eq('id', row.id).is('assistant_overdue_notified_at', null)
          .select('id')
        if (!claimed?.length) continue
        await service.from('support_messages').insert({
          conversation_id: row.id, author_type: 'system', internal: true,
          body: `Past its reply target (${row.priority}, ${targetMinutes(row.priority)} working minutes). Staff notified again.`,
        })
        await notifyStaff({
          conversationId: row.id, priority: row.priority,
          topic: 'A handed-off case has passed its reply target with no reply from the team.',
          reason: 'overdue', lead: (row.tags ?? []).includes('lead'),
        })
        n++
      }
      return n
    })

    if (count) logger.info(`support-assistant-overdue: ${count} cases re-notified`)
    return { overdue: count }
  },
)
