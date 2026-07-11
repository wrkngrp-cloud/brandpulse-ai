'use server'

import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

const APP_URL = process.env.APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'

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
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <p style="font-size: 16px; line-height: 1.6;">Hi there,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #444;">
        ${brandName} is running a quick survey to understand how we can serve you better.
        It takes less than 2 minutes.
      </p>
      <p style="margin: 28px 0;">
        <a href="${surveyUrl}"
           style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none;
                  padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">
          Take the survey
        </a>
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.5;">
        Or copy this link: <a href="${surveyUrl}" style="color: #555;">${surveyUrl}</a>
      </p>
      <p style="font-size: 13px; color: #aaa; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
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
    const { error } = await resend.emails.send({
      from: `${brandName} <surveys@brandgauge.app>`,
      to:   batch,
      subject,
      html,
    })
    if (error) return { error: error.message }
    sent += batch.length
  }

  return { sent }
}
