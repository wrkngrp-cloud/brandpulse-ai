import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { captureLead, headlineFrom } from '@/lib/tools/leads'
import { gateResult, LEAD_ROLES } from '@/lib/tools/gate'
import { runByToken, hashIp, ipOf } from '@/lib/tools/runs'
import { recordEvent } from '@/lib/tools/events'
import { cacheGet, cacheSet } from '@/lib/tools/limits'
import { toolById, type ToolId } from '@/lib/tools/registry'
import type { ToolReport } from '@/lib/tools/report'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Unlock a report with an email address.
 *
 * Open by necessity, like the tools themselves: the person answering has no
 * account, which is the entire point. What guards it is the run token, which
 * only the person who ran the analysis holds, plus a per-IP ceiling so the
 * endpoint cannot be used to write unbounded rows.
 *
 * The full result is returned from the server here rather than revealed by
 * the client, because the gated response never contained it in the first
 * place. That is the difference between a gate and a blur.
 */

const Body = z.object({
  token:           z.string().min(20).max(200),
  email:           z.string().trim().toLowerCase().email().max(160),
  name:            z.string().trim().max(80).optional(),
  role:            z.enum(LEAD_ROLES).optional(),
  wantsMonitoring: z.boolean().default(false),
  consentText:     z.string().trim().min(10).max(500),
  visitorId:       z.string().max(64).optional(),
})

const UNLOCKS_PER_HOUR = 15

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please give us a working email address.' }, { status: 400 })
  }
  const d = parsed.data

  const ipHash = hashIp(ipOf(req))
  const key = `tool:unlock:${ipHash}`
  const seen = (await cacheGet<number>(key)) ?? 0
  if (seen >= UNLOCKS_PER_HOUR) {
    return NextResponse.json({ error: 'That is a lot of reports from one connection. Try again later.' }, { status: 429 })
  }
  await cacheSet(key, seen + 1, 3600)

  const run = await runByToken<Record<string, unknown>>(d.token)
  if (!run) return NextResponse.json({ error: 'That report has expired or never existed.' }, { status: 404 })
  if (run.status !== 'complete' || !run.result) {
    return NextResponse.json({ error: 'That analysis did not finish, so there is nothing to send.' }, { status: 409 })
  }

  const report = (run.result as { report?: ToolReport }).report

  const captured = await captureLead({
    runId:  run.id,
    toolId: run.toolId,
    email:  d.email,
    name:   d.name,
    role:   d.role,
    inputs: run.inputs,
    headline: headlineFrom(report),
    wantsMonitoring: d.wantsMonitoring,
    consentText: d.consentText,
  })

  if (!captured.ok) {
    return NextResponse.json({ error: 'We could not save that. Try again in a moment.' }, { status: 500 })
  }

  await recordEvent({
    event: 'free_tool_lead_captured',
    toolId: run.toolId,
    runId: run.id,
    visitorId: d.visitorId,
    props: { wantsMonitoring: d.wantsMonitoring, role: d.role ?? '' },
  })

  // The emailed copy is the reason the address is worth giving, so a failure
  // to send is logged and never blocks the unlock: they can already read it.
  void sendReportEmail(d.email, run.toolId, report, d.token).catch(err =>
    console.error('[tools] report email failed:', err))

  const { result } = gateResult(run.toolId, run.result as Record<string, unknown>, true)
  return NextResponse.json({ status: 'complete', gated: false, result })
}

let resend: Resend | null = null
function client(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  resend ??= new Resend(process.env.RESEND_API_KEY)
  return resend
}

async function sendReportEmail(to: string, toolId: ToolId, report: ToolReport | undefined, token: string) {
  const mailer = client()
  if (!mailer || !report) return

  const tool = toolById(toolId)
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://brandgauge.app').replace(/\/$/, '')
  const link = `${base}${tool?.route ?? '/tools'}?report=${encodeURIComponent(token)}`

  const findings = report.findings.map((f, i) => {
    const source = f.evidence[0]
    return [
      `${i + 1}. ${f.title}`,
      f.significance ? `   ${f.significance}` : null,
      source ? `   Source: ${source.sourceName ?? source.sourceUrl}  ${source.sourceUrl}` : null,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const body = [
    report.title,
    '',
    report.summary,
    '',
    findings,
    '',
    report.nextAction ? `What to do next\n${report.nextAction}` : null,
    '',
    'What this cannot tell you',
    ...report.limitations.map(l => `- ${l}`),
    '',
    `Open the full report: ${link}`,
    '',
    'You are getting this because you asked us to send it. We will not add you to anything else.',
  ].filter(v => v !== null).join('\n')

  await mailer.emails.send({
    from: 'BrandGauge <hello@brandgauge.app>',
    to,
    subject: report.title,
    text: body,
  })
}
