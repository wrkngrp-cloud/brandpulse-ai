import { createServiceClient } from '@/lib/supabase/server'

/**
 * Usage telemetry, written server-side only.
 *
 * Every function here is deliberately silent on failure. A dropped telemetry
 * row costs us a number on an internal screen; a thrown telemetry error would
 * cost the customer their AI answer. The write is never the point of the
 * request it rides along with.
 */

export interface AiCallRecord {
  workspaceId?: string | null
  brandId?:     string | null
  userId?:      string | null
  tier:         'cultural' | 'structural' | 'chat' | 'boardGrade'
  model:        string
  feature:      string
  inputTokens:  number
  outputTokens: number
  cacheReadTokens?: number
  costUsd?:     number | null
  latencyMs?:   number | null
  ok?:          boolean
  error?:       string | null
}

export async function recordAiCall(call: AiCallRecord): Promise<void> {
  try {
    const service = await createServiceClient()
    await service.from('ai_calls').insert({
      workspace_id:  call.workspaceId ?? null,
      brand_id:      call.brandId ?? null,
      user_id:       call.userId ?? null,
      tier:          call.tier,
      model:         call.model,
      feature:       call.feature,
      input_tokens:  call.inputTokens,
      output_tokens: call.outputTokens,
      cache_read_tokens: call.cacheReadTokens ?? 0,
      cost_usd:      call.costUsd ?? null,
      latency_ms:    call.latencyMs ?? null,
      ok:            call.ok ?? true,
      error:         call.error ?? null,
    })

    // The counter the customer's own billing page reads. Only a successful call
    // counts against a plan: we do not bill someone for our outage.
    if ((call.ok ?? true) && call.workspaceId) {
      await recordUsageEvent({
        workspaceId: call.workspaceId,
        brandId:     call.brandId ?? null,
        userId:      call.userId ?? null,
        type:        'ai_call',
      })
    }
  } catch {
    // Telemetry never breaks the feature it measures.
  }
}

export async function recordUsageEvent(opts: {
  workspaceId: string
  brandId?:    string | null
  userId?:     string | null
  type:        'ai_call' | 'survey_response' | 'portal_view'
}): Promise<void> {
  try {
    const service = await createServiceClient()
    await service.from('usage_events').insert({
      workspace_id: opts.workspaceId,
      brand_id:     opts.brandId ?? null,
      user_id:      opts.userId ?? null,
      event_type:   opts.type,
    })
  } catch {
    // As above.
  }
}
