import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { runScoreboard } from '@/lib/press/scoreboard'

/**
 * The Monday email the scoreboard promised.
 *
 * Anyone who ticked the box on the public tool gets their four brands re-run
 * once a week, and hears from us when their share has moved. It is the whole
 * reason the free tool captures an address worth having: a one-off audit buys
 * one email and then silence, while a standing weekly reason to write is a
 * relationship, and it is the same shape as the product they would be paying
 * for.
 *
 * Two rules, both of them the promise rather than the mechanics. Only leads
 * with `wants_weekly` are written to, and a lead marked dead is left alone.
 */

let resend: Resend | null = null
const getResend = () => (resend ??= new Resend(process.env.RESEND_API_KEY))

const naira = (n: number) =>
  n >= 1_000_000 ? `NGN ${(n / 1_000_000).toFixed(1)}m` : `NGN ${Math.round(n / 1_000)}k`

interface ScanRow {
  brand_name: string
  competitors: string[]
  share_of_reach: number | null
}

export const scoreboardWeekly = inngest.createFunction(
  {
    id:       'scoreboard-weekly',
    name:     'Scoreboard: weekly press email to opted-in leads',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 8 * * 1' }],
    retries:  1,
  },
  async ({
    step,
    logger,
  }: {
    step:   { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> }
    logger: { info: (msg: string, ...args: unknown[]) => void }
  }) => {
    if (!process.env.RESEND_API_KEY) {
      logger.info('scoreboard-weekly: no RESEND_API_KEY, nothing sent')
      return { sent: 0 }
    }

    const rows = await step.run('load-opted-in-leads', async () => {
      const svc = await createServiceClient()
      const { data } = await svc
        .from('leads')
        .select('id, email, name, scan_id, public_scans(brand_name, competitors, share_of_reach)')
        .eq('wants_weekly', true)
        .neq('status', 'dead')
        .limit(500)
      return (data ?? []) as unknown as {
        id: string; email: string; name: string | null; scan_id: string | null
        public_scans: ScanRow | null
      }[]
    })

    let sent = 0

    for (const lead of rows) {
      const scan = lead.public_scans
      if (!scan?.brand_name) continue

      await step.run(`weekly-${lead.id}`, async () => {
        const board = await runScoreboard(scan.brand_name, scan.competitors ?? [])
        const me = board.brands.find(b => b.isSubject)
        if (!me) return

        const was = scan.share_of_reach
        const now = me.shareOfReach
        const moved = was == null ? null : Math.round((now - was) * 10) / 10

        const table = [...board.brands]
          .sort((a, b) => b.shareOfReach - a.shareOfReach)
          .map(b => `  ${b.shareOfReach.toString().padStart(5)}%  ${naira(b.totalEmv).padEnd(12)} ${b.name}`)
          .join('\n')

        const lines = [
          `${scan.brand_name}, last 30 days of Nigerian press.`,
          '',
          `You hold ${now}% of the earned reach in your set.`,
          moved == null ? '' : moved === 0
            ? 'No change since we last looked.'
            : `That is ${moved > 0 ? 'up' : 'down'} ${Math.abs(moved)} points since we last looked.`,
          '',
          table,
          '',
          board.regulatory.length
            ? `A regulator was named ${board.regulatory.length} time${board.regulatory.length > 1 ? 's' : ''} this week. Details on the board.`
            : '',
          '',
          `The full board: ${process.env.APP_URL ?? 'https://brandgauge.app'}/scoreboard`,
          '',
          'Press is one signal. Sentiment in Pidgin, Yoruba, Igbo and Hausa, share of voice,',
          'what AI says about you and what your offline spend returned are in the product,',
          'free while we are in beta.',
          '',
          'Reply STOP and we will not write again.',
        ].filter(Boolean).join('\n')

        await getResend().emails.send({
          from:    'BrandGauge <scoreboard@brandgauge.app>',
          to:      lead.email,
          subject: `${scan.brand_name}: ${now}% of your category's press this week`,
          text:    lines,
        })

        // Move the baseline, so next week compares against this week rather
        // than against the day they first ran it.
        if (lead.scan_id) {
          const svc = await createServiceClient()
          await svc.from('public_scans').update({ share_of_reach: now }).eq('id', lead.scan_id)
        }
        sent++
      })
    }

    logger.info(`scoreboard-weekly: ${sent} sent`)
    return { sent }
  },
)
