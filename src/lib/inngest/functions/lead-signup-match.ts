import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Close the loop between a lead and the account they became.
 *
 * `leads.signed_up` has always been a boolean somebody had to remember to
 * tick, which means it has always been wrong. The address is right there in
 * both tables, so this matches them nightly and the conversion rate per
 * referrer stops being a feeling.
 *
 * It only ever sets the flag to true. A lead who signed up and later deleted
 * their account still converted, and a job that un-ticks things would quietly
 * rewrite history every night.
 */
export const leadSignupMatch = inngest.createFunction(
  {
    id:   'lead-signup-match',
    name: 'Match leads to signups (nightly 3 AM Lagos)',
    triggers: [{ cron: 'TZ=Africa/Lagos 0 3 * * *' }],
  },
  async ({ step, logger }) => {
    const matched = await step.run('match-on-email', async () => {
      const service = await createServiceClient()

      const { data: pending } = await service
        .from('leads')
        .select('id, email')
        .eq('signed_up', false)
        .limit(2000)

      if (!pending?.length) return 0

      // One lookup for the whole batch rather than one per lead.
      const { data: found } = await service.rpc('auth_user_ids_for_emails', {
        p_emails: pending.map(l => l.email.toLowerCase()),
      })

      const signedUp = new Set(
        ((found ?? []) as unknown as { email: string }[]).map(r => r.email.toLowerCase()),
      )

      const hits = pending.filter(l => signedUp.has(l.email.toLowerCase()))
      if (!hits.length) return 0

      await service.from('leads')
        .update({ signed_up: true })
        .in('id', hits.map(l => l.id))

      return hits.length
    })

    if (matched) logger.info(`lead-signup-match: marked ${matched} leads as signed up`)
    return { matched }
  },
)
