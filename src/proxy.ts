import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/safe-next'

/**
 * The Desk's own host.
 *
 * desk.brandgauge.app is this same app and this same deploy, routed by
 * hostname onto the /desk path. One deploy means one service client, one
 * TOKEN_ENCRYPTION_KEY and one Inngest registry rather than two copies of
 * each, and the separation that matters is kept: its own URL, its own login,
 * and its own session cookie, because Supabase writes that cookie host-only.
 *
 * Until DESK_HOST is set, /desk answers on the main host, which is how the
 * Desk is previewed on a Vercel deployment URL. The moment it is set, the
 * rewrite turns on and the path on the main host closes in the same request.
 */
const DESK_HOST = process.env.DESK_HOST?.trim().toLowerCase() || null

function hostOf(request: NextRequest): string {
  return (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const host     = hostOf(request)
  const onDesk   = DESK_HOST !== null && host === DESK_HOST
  const deskPath = onDesk
    ? '/desk' + (request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname)
    : request.nextUrl.pathname

  // The Desk host serves the Desk and nothing else, and the main host stops
  // serving /desk the moment the Desk has a host of its own. Both refusals are
  // here so neither can be reached by a route that forgot to check.
  if (onDesk && request.nextUrl.pathname.startsWith('/desk')) {
    return new NextResponse('Not found', { status: 404 })
  }
  if (!onDesk && DESK_HOST !== null && request.nextUrl.pathname.startsWith('/desk')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  /**
   * Impersonation is read-only, and this is where that is true.
   *
   * An approved session adds the staff member to workspace_members on the
   * viewer role, so the product's own row-level security shows them the data
   * and no read path had to be rewritten. Nothing in the schema makes 'viewer'
   * read-only, so the guarantee lives here instead: while a session is live,
   * anything that is not a GET or a HEAD is refused, and every /api/ path is
   * refused outright.
   *
   * One check in one place, which a new route cannot opt out of by being new.
   * It rests on one assumption worth stating: that nothing in this app mutates
   * on a GET. Server actions post, and every write route is a POST, PATCH or
   * DELETE.
   */
  if (user && !pathname.startsWith('/desk')) {
    let impersonating: string | null = null
    try {
      const { data } = await supabase.rpc('active_impersonation', { p_staff: user.id })
      impersonating = (data as string | null) ?? null
    } catch {
      // If we cannot tell, let the request through. The alternative is locking
      // a real customer out of their own account on a transient error.
      impersonating = null
    }

    if (impersonating) {
      const isRead = request.method === 'GET' || request.method === 'HEAD'
      if (!isRead || pathname.startsWith('/api/')) {
        return new NextResponse(
          'This is a read-only session. End it to make changes.',
          { status: 403 },
        )
      }
    }
  }

  // The Desk. A signed-out visitor gets the login page; whether a signed-in
  // one is staff at all is settled in the /desk layout, which has the database
  // to hand and can say so properly rather than bouncing them.
  if (deskPath.startsWith('/desk')) {
    const isPublicDeskPath =
      deskPath.startsWith('/desk/login') || deskPath.startsWith('/desk/invite')

    if (!user && !isPublicDeskPath) {
      const login = new URL(onDesk ? '/login' : '/desk/login', request.url)
      login.searchParams.set('next', deskPath)
      return NextResponse.redirect(login)
    }

    if (onDesk) {
      const rewritten = new URL(deskPath, request.url)
      rewritten.search = request.nextUrl.search
      return NextResponse.rewrite(rewritten, { headers: supabaseResponse.headers })
    }
    return supabaseResponse
  }

  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  if (!user && pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  if (user && (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup'))) {
    /* Honour `next`. A signed-in marketer who finishes a free tool and clicks
       "continue in BrandGauge" arrives here with their report token in `next`;
       bouncing them to /dashboard threw the report away and asked them to
       start again. Checked against open redirects by safeNext. */
    const next = safeNext(request.nextUrl.searchParams.get('next'))
    return NextResponse.redirect(new URL(next, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/inngest|survey|go|ambassador|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|css|js|mp4)$).*)',
  ],
}
