import { createServiceClient } from '@/lib/supabase/server'
import { assistantMode, type AssistantMode } from './config'

/**
 * The live mode: the Desk's override, in front of the env var.
 *
 * config.ts cannot read the database (scripts/support-assistant-eval.ts
 * imports it with no Next runtime), so this is a second file. Every caller
 * here has no Desk session (a webhook or an Inngest job), so it reads
 * through the service client the same way CLAUDE.md's "Data access" rule
 * expects for that kind of caller.
 */
export async function effectiveAssistantMode(): Promise<AssistantMode> {
  try {
    const service = await createServiceClient()
    const { data } = await service
      .from('support_assistant_settings')
      .select('mode')
      .eq('id', 1)
      .maybeSingle()
    const override = data?.mode as AssistantMode | null | undefined
    if (override === 'off' || override === 'suggest' || override === 'live') return override
  } catch {
    // A failed read (migration not applied yet, a transient error) falls
    // back to the env var rather than taking support down with it.
  }
  return assistantMode()
}
