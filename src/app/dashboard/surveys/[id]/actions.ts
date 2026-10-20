'use server'

import { sendMail } from '@/lib/email/send'
import { createClient } from '@/lib/supabase/server'
import { TOKENS } from '@/lib/brand-tokens'

const APP_URL = process.env.APP_URL || 'https://brandpulse-ai-tau.vercel.app'

export async function sendSurveyEmails(
  surveyId: string,
  emails:   string[],
): Promise<{ sent?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: survey } = await supabase
    .from('surveys')
    .select('id, name, brand_id')
    .eq('id', surveyId)
    .single()
  if (!survey) return { error: 'Survey not found.' }

  const { data: brand } = await supabase
    .from('brands')
    .select('name')
    .eq('id', survey.brand_id)
    .single()

  const brandName = brand?.name ?? 'Us'
  const surveyUrl = `${APP_URL}/survey/${surveyId}`

  const subject = `${brandName} would love your feedback — 2 minutes`
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: var(--tx);">
      <p style="font-size: 16px; line-height: 1.6;">Hi there,</p>
      <p style="font-size: 15px; line-height: 1.6; color: var(--tx-2);">
        ${brandName} is running a quick survey to understand how we can serve you better.
        It takes less than 2 minutes.
      </p>
      <p style="margin: 28px 0;">
        <a href="${surveyUrl}"
           style="display: inline-block; background: ${TOKENS.ink}; color: ${TOKENS.paper}; text-decoration: none;
                  padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">
          Take the survey
        </a>
      </p>
      <p style="font-size: 13px; color: var(--tx-3); line-height: 1.5;">
        Or copy this link: <a href="${surveyUrl}" style="color: var(--tx-2);">${surveyUrl}</a>
      </p>
      <p style="font-size: 13px; color: var(--tx-3); margin-top: 32px; border-top: 1px solid var(--bg-shell); padding-top: 16px;">
        You received this because ${brandName} invited your feedback.
        This survey is powered by BrandGauge.
      </p>
    </div>
  `

  // Send in batches of 50 (Resend limit per call)
  const batches = []
  for (let i = 0; i < emails.length; i += 50) {
    batches.push(emails.slice(i, i + 50))
  }

  let sent = 0
  for (const batch of batches) {
    const mail = await sendMail({
      from: `${brandName} <surveys@brandgauge.app>`,
      to:   batch,
      subject,
      html,
    })
    if (!mail.sent) return { error: `The invitations did not go out: ${mail.reason}.` }
    sent += batch.length
  }

  return { sent }
}
