'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireStaffOrNull, writeAudit } from '@/lib/desk/auth'
import { createServiceClient } from '@/lib/supabase/server'

export type AssistantModeState = { error?: string; ok?: string } | null

const schema = z.object({ mode: z.enum(['env', 'off', 'suggest', 'live']) })

export async function setAssistantMode(_prev: AssistantModeState, formData: FormData): Promise<AssistantModeState> {
  const session = await requireStaffOrNull('support.manage_assistant')
  if (!session) return { error: 'You do not have permission to change this.' }

  const parsed = schema.safeParse({ mode: formData.get('mode') })
  if (!parsed.success) return { error: 'That mode did not look right.' }
  const mode = parsed.data.mode === 'env' ? null : parsed.data.mode

  const service = await createServiceClient()
  const { error } = await service
    .from('support_assistant_settings')
    .update({ mode, updated_by: session.userId, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) return { error: 'Could not save that.' }

  await writeAudit({
    actorId: session.userId,
    action:  'support.assistant_mode_change',
    summary: `Set the support assistant to ${mode ?? 'follow the environment variable'}`,
  })
  revalidatePath('/desk/inbox/assistant')
  return { ok: 'Saved.' }
}
