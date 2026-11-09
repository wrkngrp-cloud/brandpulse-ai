import { createServiceClient } from '@/lib/supabase/server'
import { assistantMode, type AssistantMode } from '@/lib/support/assistant/config'
import type { StaffSession } from './auth'

export interface AssistantSettings {
  /** null: no override, SUPPORT_ASSISTANT_MODE decides. */
  override:  AssistantMode | null
  envMode:   AssistantMode
  updatedBy: string | null
  updatedAt: string | null
}

/** Visibility is support.view, same as the rest of the inbox. Editing is checked separately, in the action. */
export async function assistantSettings(session: StaffSession): Promise<AssistantSettings | null> {
  if (!session.can('support.view')) return null

  const service = await createServiceClient()
  const { data } = await service
    .from('support_assistant_settings')
    .select('mode, updated_by, updated_at')
    .eq('id', 1)
    .maybeSingle()

  let updatedByName: string | null = null
  if (data?.updated_by) {
    const { data: who } = await service.from('staff').select('full_name').eq('user_id', data.updated_by).maybeSingle()
    updatedByName = who?.full_name ?? null
  }

  return {
    override:  (data?.mode as AssistantMode | null) ?? null,
    envMode:   assistantMode(),
    updatedBy: updatedByName,
    updatedAt: data?.updated_at ?? null,
  }
}
