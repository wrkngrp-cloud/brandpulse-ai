import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/safe-next'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
    '/((?!_next/static|_next/image|favicon.ico|api/inngest|survey|go|ambassador|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
