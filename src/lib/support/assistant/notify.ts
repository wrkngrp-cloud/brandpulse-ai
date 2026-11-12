import { createServiceClient } from '@/lib/supabase/server'
import { sendMail, emailConfigured } from '@/lib/email/send'
import { deskUrl, deskUrlIsAbsolute } from '@/lib/desk/urls'

/**
 * Telling a person that a case is waiting for them.
 *
 * Nothing in the app pinged staff about a new customer message before this
 * (internal-tool-plan.md section 4 described it; it was never built). So this
 * is the path, used for handoffs, PND-03 chases and overdue cases only, never
 * for every message:
 *
 *   * a lead (interest in BrandGauge or adopting it) goes first to every
 *     active staff member on the bizdev role, because the BDM owns it;
 *   * everything, leads included, also goes to SUPPORT_NOTIFY_EMAIL when set.
 *
 * With neither, nothing is sent and the case still waits, marked by priority,
 * in the Desk's Unassigned view, which updates live. Returns what happened so
 * the job can log it; a refused email is never counted as sent.
 */
export async function notifyStaff(opts: {
  conversationId: string
  priority: string
  topic: string
  reason: 'handoff' | 'chase' | 'overdue'
  lead: boolean
}): Promise<{ sent: number; failed: number; skipped: string | null }> {
  if (!emailConfigured()) return { sent: 0, failed: 0, skipped: 'email not configured' }

  const recipients: string[] = []
  if (opts.lead) {
    const service = await createServiceClient()
    const { data } = await service
      .from('staff')
      .select('email')
      .eq('role', 'bizdev')
      .eq('status', 'active')
    for (const row of data ?? []) if (row.email) recipients.push(row.email)
  }
  const general = process.env.SUPPORT_NOTIFY_EMAIL?.trim()
  if (general) recipients.push(...general.split(',').map(s => s.trim()).filter(Boolean))

  const unique = [...new Set(recipients.map(r => r.toLowerCase()))]
  if (!unique.length) return { sent: 0, failed: 0, skipped: 'no recipients (set SUPPORT_NOTIFY_EMAIL)' }

  const link = deskUrlIsAbsolute() ? deskUrl(`/inbox/${opts.conversationId}`) : null
  const label = opts.priority[0].toUpperCase() + opts.priority.slice(1)
  const lead = opts.lead ? 'Lead. ' : ''
  const subject = {
    handoff: `${lead}${label}: a support case is waiting for you`,
    chase:   `${lead}${label}: the customer is chasing a support case`,
    overdue: `${lead}${label}: a support case is past its reply target`,
  }[opts.reason]

  let sent = 0
  let failed = 0
  for (const to of unique) {
    const result = await sendMail({
      from:    'BrandGauge Desk <support@brandgauge.app>',
      to,
      subject,
      text:
`${opts.topic}

Priority: ${label}${opts.lead ? '\nThis is a lead. The BDM owns the follow-up.' : ''}

${link ? `Open the case: ${link}` : 'Open the Desk inbox to pick it up.'}`,
    })
    if (result.sent) sent++
    else {
      failed++
      console.error('[support-assistant] staff notification not sent:', result)
    }
  }
  return { sent, failed, skipped: null }
}
