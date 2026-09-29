import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 20

/**
 * The address, given freely.
 *
 * The board is shown before this is asked for. Gating a result someone has
 * already earned is what makes a free tool stop being shared, and a lead who
 * only gave an address to see a number they were promised is not a lead.
 * What this buys them is the weekly watch and the PDF, which are things we do
 * for them rather than things we withhold.
 *
 * `wants_weekly` is a promise. It is only true when they ticked the box, and
 * the Monday job reads that column, so an unticked box is a mail never sent.
 */

const Body = z.object({
  email:       z.string().trim().toLowerCase().email().max(160),
  name:        z.string().trim().max(80).optional(),
  company:     z.string().trim().max(120).optional(),
  scanId:      z.string().uuid().optional(),
  wantsWeekly: z.boolean().default(false),
})

let resend: Resend | null = null
const getResend = () => (resend ??= new Resend(process.env.RESEND_API_KEY))

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'That email does not look right.' }, { status: 400 })
  }
  const { email, name, company, scanId, wantsWeekly } = parsed.data

  const svc = await createServiceClient()

  // Someone scanning a second category is the same person, not a new lead.
  // Keep the newest scan against them and never downgrade a status the desk
  // has already moved on.
  const { error } = await svc.from('leads').upsert({
    email,
    name:         name ?? null,
    company:      company ?? null,
    scan_id:      scanId ?? null,
    source:       'scoreboard',
    wants_weekly: wantsWeekly,
  }, { onConflict: 'email' })

  if (error) {
    console.error('[scoreboard] could not save the lead:', error.message)
    return NextResponse.json({ error: 'We could not save that. Try again.' }, { status: 500 })
  }

  // Tell the desk while it is warm. A lead followed up the same day is a
  // different lead from one found in a table next week.
  const alertTo = process.env.LEAD_ALERT_EMAIL
  if (alertTo && process.env.RESEND_API_KEY) {
    try {
      const { data: scan } = scanId
        ? await svc.from('public_scans')
            .select('brand_name, competitors, share_of_reach, category')
            .eq('id', scanId).maybeSingle()
        : { data: null }

      const rivals = Array.isArray(scan?.competitors) ? (scan!.competitors as string[]).join(', ') : '—'
      await getResend().emails.send({
        from:    'BrandGauge <leads@brandgauge.app>',
        to:      alertTo.split(',').map(s => s.trim()),
        subject: `New scoreboard lead: ${company || name || email}`,
        text: [
          `${name || 'Someone'} (${email}) just ran the press scoreboard.`,
          '',
          `Brand:       ${scan?.brand_name ?? '—'}`,
          `Competitors: ${rivals}`,
          `Category:    ${scan?.category ?? '—'}`,
          `Their share of earned reach: ${scan?.share_of_reach ?? '—'}%`,
          `Wants the weekly email: ${wantsWeekly ? 'yes' : 'no'}`,
          '',
          `Work it here: ${process.env.APP_URL ?? ''}/dashboard/leads`,
        ].join('\n'),
      })
    } catch (err) {
      // The lead is saved. A failed notification must not fail the request.
      console.error('[scoreboard] lead alert failed:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
