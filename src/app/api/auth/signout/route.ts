import { type NextRequest, NextResponse } from 'next/server'
import { createClient }                  from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const origin = new URL(req.url).origin
  return NextResponse.redirect(`${origin}/auth/login`)
}
