import { Resend } from 'resend'

/* ─────────────────────────────────────────────────────────────────────────────
   Lazy Resend client

   `new Resend(undefined)` throws immediately. Building the client at module
   scope therefore turns a missing RESEND_API_KEY into a module-evaluation
   error, and any module that imports such a file dies with it. That is how a
   missing email key took down the whole Inngest serve route: every job is
   imported into `/api/inngest/route.ts`, so one eager client meant the
   endpoint 500'd and NO function could sync or run, email-related or not.

   Building it on first use instead keeps the failure local. Callers that get
   `null` skip their email step and carry on with the rest of the job.
───────────────────────────────────────────────────────────────────────────── */

let client: Resend | null | undefined

/**
 * The shared Resend client, or `null` when RESEND_API_KEY is not configured.
 * Always null-check: email is optional in local and preview environments.
 */
export function getResend(): Resend | null {
  if (client === undefined) {
    const key = process.env.RESEND_API_KEY
    client = key ? new Resend(key) : null
  }
  return client
}

/** True when outbound email is configured. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}
