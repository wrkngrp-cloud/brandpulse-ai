import { createServiceClient } from '@/lib/supabase/server'
import { hashInviteToken } from '@/lib/desk/invites'
import { BrandLockup } from '@/components/brand/logo'
import { AcceptInviteForm } from './accept-form'

export const dynamic = 'force-dynamic'

/**
 * Accepting an invitation.
 *
 * Read on the service client, because the person holding this link has no
 * session yet and so no RLS identity. The token in the URL is the only
 * credential, which is why it is compared as a hash, used once and expires.
 *
 * The page shows the address the invitation was sent to and does not let it be
 * edited. An invitation is for a person, not a form someone can retarget.
 *
 * It also asks, before rendering, whether that address already has a
 * BrandGauge account. If it does, accepting links the two and leaves the
 * existing password alone, so asking for a new one here would take a password
 * and discard it, and the person would be unable to sign in with the thing
 * they just typed. The form needs to know which case it is in.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const service = await createServiceClient()

  const { data: invite } = await service
    .from('staff_invites')
    .select('email, full_name, role, expires_at, accepted_at, revoked_at, staff_roles(label)')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle()

  // Only when the invitation is good: no reason to run an email-to-id lookup
  // for a link that is already spent.
  const { data: existingId } = invite
    ? await service.rpc('auth_user_id_for_email', { p_email: invite.email })
    : { data: null }

  const problem =
    !invite                                      ? 'This invitation link is not valid.'
    : invite.accepted_at                         ? 'This invitation has already been used.'
    : invite.revoked_at                          ? 'This invitation was withdrawn.'
    : new Date(invite.expires_at) < new Date()   ? 'This invitation has expired.'
    : null

  return (
    <main className="min-h-screen flex items-center justify-center bg-shell px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><BrandLockup /></div>

        {problem ? (
          <div className="rounded-xl border border-line bg-card p-6 text-center">
            <p className="text-sm text-tx">{problem}</p>
            <p className="mt-2 text-xs text-tx-3">
              Ask whoever invited you to send a fresh link.
            </p>
          </div>
        ) : (
          <AcceptInviteForm
            token={token}
            email={invite!.email}
            suggestedName={invite!.full_name ?? ''}
            hasAccount={Boolean(existingId)}
            roleLabel={
              (invite as unknown as { staff_roles?: { label?: string } }).staff_roles?.label
              ?? invite!.role
            }
          />
        )}
      </div>
    </main>
  )
}
