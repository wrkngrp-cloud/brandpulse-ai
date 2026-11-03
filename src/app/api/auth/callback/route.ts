import { type NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'recovery' | 'signup' | null
  const next       = safeNext(searchParams.get('next'))

  const supabase = await createClient()

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/auth/login?error=link_expired`)
    }

    // For OAuth sign-ins (Google etc.), check if this is a brand-new user
    // who doesn't have a workspace yet, and provision one automatically.
    const provider = data.user.app_metadata?.provider
    if (provider && provider !== 'email') {
      const service = await createServiceClient()

      // Any membership at all means a returning user. This was maybeSingle(),
      // which errors on two or more rows and returned null, so anyone in two
      // workspaces (an agency, an invited teammate) got a new empty workspace
      // on every Google sign-in.
      const { data: memberships, error: memberError } = await service
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', data.user.id)
        .limit(1)

      // A failed lookup is not proof they are new. Send them on rather than
      // risk creating a workspace they do not need.
      if (!memberError && !memberships?.length) {
        // New OAuth user — create workspace, member, and blank brand
        const name = data.user.user_metadata?.full_name
          ?? data.user.user_metadata?.name
          ?? data.user.email?.split('@')[0]
          ?? 'My'

        const { data: ws } = await service
          .from('workspaces')
          .insert({ name: `${name}'s Workspace` })
          .select('id')
          .single()

        if (ws) {
          await service.from('workspace_members').insert({
            workspace_id: ws.id,
            user_id:      data.user.id,
            role:         'owner',
          })
          await service.from('brands').insert({
            workspace_id: ws.id,
            name:         '',
          })
        }

        /* New Google user from a free tool: onboarding runs first, because a
           report needs a brand to attach to, and then hands them on to their
           own report rather than a cold dashboard. */
        const onward = next === '/dashboard'
          ? `${origin}/onboarding`
          : `${origin}/onboarding?next=${encodeURIComponent(next)}`
        return NextResponse.redirect(onward)
      }
    }

    return NextResponse.redirect(`${origin}${next}`)
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=link_expired`)
}
