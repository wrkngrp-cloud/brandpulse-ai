import { inngest } from '@/lib/inngest/client'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEach } from '@/lib/email/send'
import { brandRecipients } from '@/lib/email/recipients'
import { buildBrief, type BriefContent, type NeedsNumbers } from '@/lib/brief/build'
import { lastWeek, lagosClock } from '@/lib/brief/metrics'
import { TOKENS } from '@/lib/brand-tokens'

const APP_URL = process.env.APP_URL || 'https://brandgauge.app'

/**
 * Every Monday hour from 5am to noon (Lagos), wake the brands that chose that
 * hour. A brand picks its hour in the brief panel on the dashboard home.
 */
export const mondayBriefScheduler = inngest.createFunction(
  { id: 'monday-brief-scheduler', name: 'Monday Brief: wake brands at their chosen hour', triggers: [{ cron: 'TZ=Africa/Lagos 0 5-12 * * 1' }] },
  async ({ step }) => {
    const { hour, isMonday } = lagosClock()
    if (!isMonday) return { skipped: 'not Monday in Lagos' }
    const { start } = lastWeek()

    const brands = await step.run('find-brands', async () => {
      const svc = await createServiceClient()
      const { data } = await svc.from('brands').select('id').eq('brief_hour', hour).neq('name', '')
      return (data ?? []).map(b => b.id as string)
    })

    if (brands.length) {
      await step.sendEvent('fan-out', brands.map(brandId => ({ name: 'brief/generate', data: { brandId, weekStart: start, email: true } })))
    }
    return { hour, brands: brands.length }
  },
)

/** Write one brand's brief, save it, and email it once. */
export const mondayBriefGenerate = inngest.createFunction(
  { id: 'monday-brief-generate', name: 'Monday Brief: write and send one brand', triggers: [{ event: 'brief/generate' }], concurrency: { limit: 5 } },
  async ({ event, step, logger }) => {
    const { brandId, weekStart, email } = event.data as { brandId: string; weekStart: string; email?: boolean }

    const saved = await step.run('build-and-save', async () => {
      const svc = await createServiceClient()
      const outcome = await buildBrief(svc, brandId, weekStart)
      const { data, error } = await svc.from('weekly_briefs').upsert({
        brand_id: brandId, week_start: weekStart, status: outcome.status,
        content: outcome.content, updated_at: new Date().toISOString(),
      }, { onConflict: 'brand_id,week_start' }).select('id, share_token, emailed_at').single()
      if (error) throw new Error(`could not save brief: ${error.message}`)
      return { ...data, status: outcome.status, content: outcome.content }
    })

    // A brief asked for from the dashboard is shown there, not emailed. A
    // scheduled one is emailed once per week, even if it is rewritten later.
    if (!email || saved.emailed_at) return { status: saved.status, emailed: false }

    const sent = await step.run('email', async () => {
      const svc = await createServiceClient()
      const { data: brand } = await svc.from('brands').select('name').eq('id', brandId).single()
      const to = await brandRecipients(svc, brandId)
      if (!to.length) return { sent: 0, reason: 'no owner or admin email' }

      const mail = saved.status === 'ready'
        ? readyEmail(brand?.name ?? 'your brand', saved.content as BriefContent, saved.share_token as string)
        : needsNumbersEmail(brand?.name ?? 'your brand', saved.content as NeedsNumbers)
      const result = await sendEach({ from: 'BrandGauge <brief@brandgauge.app>', ...mail }, to)
      if ('reason' in result) logger.warn(`[monday-brief] ${result.sent} of ${to.length} sent for ${brandId}: ${result.reason}`)
      if (result.sent > 0) await svc.from('weekly_briefs').update({ emailed_at: new Date().toISOString() }).eq('id', saved.id)
      return { sent: result.sent }
    })
    return { status: saved.status, emailed: sent.sent > 0 }
  },
)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function readyEmail(brandName: string, c: BriefContent, token: string) {
  const link = `${APP_URL}/brief/${token}`
  const change = c.metric.changePct == null ? '' : `${c.metric.changePct > 0 ? '+' : c.metric.changePct < 0 ? '−' : ''}${Math.abs(c.metric.changePct)}%`
  const figure = c.metric.isIndex ? '' : ` (${c.metric.value.toLocaleString('en-NG')}, from ${c.metric.previous.toLocaleString('en-NG')})`
  const reasons = c.causes.map(x => `• ${x.text}${x.label === 'moved_together' ? ' [moved together, not tested]' : ''}`)
  return {
    subject: `${brandName}: ${c.headline}`,
    text: [
      `Your Monday Brief, ${c.weekLabel}`, '',
      `${c.metric.label}: ${change}${figure}`, '',
      c.summary, '',
      ...(reasons.length ? ['What moved with it:', ...reasons, ''] : []),
      ...(c.watchNext ? [`This week, watch: ${c.watchNext}`, ''] : []),
      `Read it, or forward it to your boss (no login needed): ${link}`,
    ].join('\n'),
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;line-height:1.55">
      <p style="font-size:13px;color:${TOKENS.tx2};margin:0">Your Monday Brief · ${esc(c.weekLabel)}</p>
      <h2 style="font-size:20px;margin:6px 0 4px">${esc(c.headline)}</h2>
      <p style="font-size:14px;margin:0 0 14px"><strong>${esc(c.metric.label)}: ${esc(change)}</strong>${esc(figure)}</p>
      <p style="font-size:14px">${esc(c.summary)}</p>
      ${c.causes.length ? `<p style="font-size:13px;margin:14px 0 4px"><strong>What moved with it</strong></p><ul style="font-size:14px;padding-left:18px">${c.causes.map(x => `<li>${esc(x.text)}${x.label === 'moved_together' ? ' <span style="color:${TOKENS.tx2}">(moved together, not tested)</span>' : ''}</li>`).join('')}</ul>` : ''}
      ${c.watchNext ? `<p style="font-size:14px"><strong>This week, watch:</strong> ${esc(c.watchNext)}</p>` : ''}
      <p style="margin:22px 0"><a href="${link}" style="background:${TOKENS.ink};color:${TOKENS.paper};padding:10px 20px;text-decoration:none;border-radius:3px;font-size:14px">Read the full brief</a></p>
      <p style="font-size:12px;color:${TOKENS.tx2}">You can forward that link. It opens without a login.</p>
    </div>`,
  }
}

function needsNumbersEmail(brandName: string, c: NeedsNumbers) {
  const link = `${APP_URL}/dashboard`
  const ask = c.missing === 'last_week'
    ? c.metric.question
    : `${c.metric.question} We also need the week before, so there is something to compare it with.`
  return {
    subject: `${brandName}: one number for your Monday Brief`,
    text: [`Your Monday Brief for ${c.weekLabel} is waiting on one number.`, '', ask, '', `It takes ten seconds: ${link}`].join('\n'),
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;line-height:1.55">
      <p style="font-size:14px">Your Monday Brief for ${esc(c.weekLabel)} is waiting on one number.</p>
      <p style="font-size:16px"><strong>${esc(ask)}</strong></p>
      <p style="margin:22px 0"><a href="${link}" style="background:${TOKENS.ink};color:${TOKENS.paper};padding:10px 20px;text-decoration:none;border-radius:3px;font-size:14px">Add it now</a></p>
      <p style="font-size:12px;color:${TOKENS.tx2}">Prefer not to share real figures? Enter 100 for a normal week and we will work in percentages.</p>
    </div>`,
  }
}
