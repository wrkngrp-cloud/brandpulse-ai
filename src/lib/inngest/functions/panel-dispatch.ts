import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend  = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'

// ── Daily cron: find panels due and fire dispatch events ─────────────────────
export const panelDailyCheck = inngest.createFunction(
  {
    id: 'panel-daily-check',
    name: 'Panel Daily Check',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 9 * * *' }],
  },
  async () => {
    const supabase = await createServiceClient()
    const now = new Date().toISOString()

    const { data: panels } = await supabase
      .from('survey_panels')
      .select('id')
      .eq('active', true)
      .lte('next_run_at', now)

    if (!panels?.length) return { dispatched: 0 }

    for (const panel of panels) {
      await inngest.send({ name: 'panel/dispatch', data: { panelId: panel.id } })
    }

    return { dispatched: panels.length }
  },
)

// ── Panel dispatch: create survey instance and send to recipients ─────────────
export const panelDispatch = inngest.createFunction(
  {
    id: 'panel-dispatch',
    name: 'Panel Dispatch',
    triggers: [{ event: 'panel/dispatch' }],
    concurrency: { limit: 5 },
  },
  async ({ event, step }: { event: { data: { panelId: string } }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { panelId } = event.data
    const supabase = await createServiceClient()

    const panel = await step.run('load-panel', async () => {
      const { data } = await supabase
        .from('survey_panels')
        .select('*, brands(name), workspaces(id)')
        .eq('id', panelId)
        .single()
      return data
    })

    if (!panel || !panel.active) return { skipped: true }

    const survey = await step.run('create-survey', async () => {
      const { data, error } = await supabase.from('surveys').insert({
        brand_id:    panel.brand_id,
        workspace_id: panel.workspace_id,
        name:        `${panel.name} — ${new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })}`,
        type:        panel.template_key,
        status:      'active',
        is_panel:    true,
        panel_id:    panel.id,
      }).select('id').single()
      if (error) throw new Error(error.message)
      return data
    })

    const surveyUrl = `${APP_URL}/survey/${survey.id}`
    const brandName = (panel.brands as { name: string } | null)?.name ?? 'Us'

    if (panel.recipient_emails?.length > 0) {
      await step.run('send-emails', async () => {
        const batches: string[][] = []
        for (let i = 0; i < panel.recipient_emails.length; i += 50) {
          batches.push(panel.recipient_emails.slice(i, i + 50))
        }
        for (const batch of batches) {
          await resend.emails.send({
            from:    `${brandName} <surveys@brandgauge.app>`,
            to:      batch,
            subject: `${brandName} — ${panel.name} (${new Date().toLocaleDateString('en-NG', { month: 'long', timeZone: 'Africa/Lagos' })})`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
              <p style="font-size:15px;line-height:1.6;">${brandName} is running its ${panel.cadence} tracking survey. It takes less than 2 minutes.</p>
              <p style="margin:28px 0;"><a href="${surveyUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">Take the survey</a></p>
              <p style="font-size:13px;color:#aaa;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">Powered by BrandGauge</p>
            </div>`,
          })
        }
      })
    }

    if (panel.recipient_phones?.length > 0 && process.env.AFRICAS_TALKING_API_KEY) {
      await step.run('send-whatsapp', async () => {
        const message = `Hi! ${brandName} is running its ${panel.cadence} brand tracking survey. It takes less than 2 minutes:\n${surveyUrl}`
        const batches: string[][] = []
        for (let i = 0; i < panel.recipient_phones.length; i += 20) {
          batches.push(panel.recipient_phones.slice(i, i + 20))
        }
        for (const batch of batches) {
          await fetch('https://content.africastalking.com/version1/messaging/whatsapp', {
            method: 'POST',
            headers: { 'apiKey': process.env.AFRICAS_TALKING_API_KEY!, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: process.env.AFRICAS_TALKING_USERNAME ?? 'sandbox',
              to: batch, message,
              from: process.env.AFRICAS_TALKING_WHATSAPP_SENDER,
            }),
          })
        }
      })
    }

    await step.run('advance-schedule', async () => {
      const next = new Date()
      if (panel.cadence === 'monthly') {
        next.setMonth(next.getMonth() + 1)
      } else {
        next.setMonth(next.getMonth() + 3)
      }
      next.setDate(1)
      next.setHours(9, 0, 0, 0)
      await supabase.from('survey_panels').update({
        last_run_at: new Date().toISOString(),
        next_run_at: next.toISOString(),
      }).eq('id', panelId)
    })

    return {
      surveyId:   survey.id,
      emailsSent: panel.recipient_emails?.length ?? 0,
      phonesSent: panel.recipient_phones?.length ?? 0,
    }
  },
)
