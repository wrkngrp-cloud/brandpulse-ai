import { requireStaff } from '@/lib/desk/auth'
import { assistantSettings } from '@/lib/desk/assistant-settings'
import { PageHeader } from '@/components/dashboard/page-header'
import { BotIcon } from '@/components/brand/icon'
import { AssistantModeForm } from './assistant-mode-form'

export const dynamic = 'force-dynamic'

/**
 * The assistant's mode, visible to anyone who can open the inbox, editable
 * only by an admin or super admin. Flipping live auto-reply on or off is a
 * business decision, not a day-to-day support action.
 */
export default async function AssistantSettingsPage() {
  const session = await requireStaff('support.view', {
    action: 'support.assistant_view', summary: 'Opened the assistant settings',
  })
  const settings = await assistantSettings(session)
  if (!settings) return null
  const canEdit = session.can('support.manage_assistant')
  const effective = settings.override ?? settings.envMode

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Assistant"
        subtitle="Off, suggest or live. Everyone who can open the inbox can see this; only an admin or super admin can change it."
        icon={BotIcon}
      />

      <div className="rounded-xl border border-line bg-card p-4">
        <p className="bg-label text-[0.65rem] text-tx-3">Right now</p>
        <p className="mt-1.5 text-2xl capitalize">{effective}</p>
        <p className="mt-1 text-xs text-tx-3">
          {settings.override
            ? `Overridden in the Desk${settings.updatedBy ? ` by ${settings.updatedBy}` : ''}${settings.updatedAt ? ` on ${new Date(settings.updatedAt).toLocaleString('en-NG')}` : ''}. The environment variable underneath is "${settings.envMode}".`
            : `Following the environment variable (SUPPORT_ASSISTANT_MODE=${settings.envMode}). No Desk override is set.`}
        </p>
      </div>

      {canEdit
        ? <AssistantModeForm current={settings.override} />
        : <p className="text-sm text-tx-3">Only an admin or super admin can change this.</p>}
    </div>
  )
}
