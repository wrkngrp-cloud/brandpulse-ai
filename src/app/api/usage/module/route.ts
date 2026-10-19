import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'
import { isModuleKey } from '@/lib/modules'
import { z } from 'zod'

/**
 * Records that a signed-in user opened a dashboard module.
 *
 * This is the only write behind every adoption number on the Desk. Three
 * things about how it is built:
 *
 * It runs on the RLS client and writes through `record_feature_event`, a
 * security-definer function that resolves the workspace from the brand and
 * refuses unless the caller is a member of it. So there is no service-role key
 * in this path and no ownership check to forget: the database makes the check
 * and the route cannot aim a write at someone else's workspace.
 *
 * The module arrives as a key from the registry, never as a path. An
 * unrecognised key is dropped rather than stored, so a crafted request cannot
 * fill the table with junk rows that would then appear on an internal screen.
 *
 * It answers 204 whatever happens. The caller is a fire-and-forget beacon and
 * nothing in the product should change because telemetry failed.
 */

const Body = z.object({ module: z.string().min(1).max(64) })

export async function POST(request: NextRequest) {
  try {
    const parsed = Body.safeParse(await request.json().catch(() => null))
    if (!parsed.success || !isModuleKey(parsed.data.module)) {
      return new NextResponse(null, { status: 204 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse(null, { status: 204 })

    const brandId = await getActiveBrandId(supabase)
    if (!brandId) return new NextResponse(null, { status: 204 })

    await supabase.rpc('record_feature_event', {
      p_brand_id: brandId,
      p_module:   parsed.data.module,
    })
  } catch {
    // Telemetry never breaks a page.
  }

  return new NextResponse(null, { status: 204 })
}
