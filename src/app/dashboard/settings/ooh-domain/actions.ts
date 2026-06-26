'use server'

import { createClient }       from '@/lib/supabase/server'
import { getActiveBrandId }   from '@/lib/active-brand'
import { revalidatePath }     from 'next/cache'
import { z }                  from 'zod'

const VERCEL_TOKEN      = process.env.VERCEL_TOKEN
const VERCEL_PROJECT_ID = 'prj_Wr7y98TO3Ww5Ricwfe4PgJl8sFAT'
const VERCEL_TEAM_ID    = 'team_bPqIhlhQbEKLpYOw7M8EN63S'

const DomainSchema = z.object({
  domain: z
    .string()
    .min(4, 'Domain is required')
    .regex(
      /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i,
      'Enter a valid domain like go.yourbrand.com',
    ),
})

type State = { error?: string; success?: string; cname?: string } | null

// Add a custom domain to Vercel so it routes to this deployment
async function addDomainToVercel(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!VERCEL_TOKEN) return { ok: false, error: 'VERCEL_TOKEN not configured' }

  const url = `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains?teamId=${VERCEL_TEAM_ID}`
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domain }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // 409 = already added — treat as success
    if (res.status === 409) return { ok: true }
    return { ok: false, error: data?.error?.message ?? `Vercel API error ${res.status}` }
  }
  return { ok: true }
}

export async function saveOohDomain(_prev: State, formData: FormData): Promise<State> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const raw    = Object.fromEntries(formData.entries())
  const parsed = DomainSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const domain = parsed.data.domain.toLowerCase().trim()

  // Add to Vercel so the custom domain routes to our app
  const vercel = await addDomainToVercel(domain)
  if (!vercel.ok) {
    return { error: `Could not add domain to our routing: ${vercel.error}. Add VERCEL_TOKEN to env vars.` }
  }

  // Save on the brand record
  const { error } = await supabase
    .from('brands')
    .update({ ooh_redirect_domain: domain, ooh_redirect_domain_verified: false })
    .eq('id', (await getActiveBrandId(supabase)) ?? '')

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings/ooh-domain')
  return {
    success: `Domain saved. Point your DNS CNAME as shown below, then test a link.`,
    cname: domain,
  }
}

export async function removeOohDomain(): Promise<State> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return { error: 'No active brand' }
  const { data: brand } = await supabase.from('brands').select('ooh_redirect_domain').eq('id', brandId).single()
  if (!brand) return { error: 'Brand not found' }

  // Remove from Vercel
  if (brand.ooh_redirect_domain && VERCEL_TOKEN) {
    const url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${brand.ooh_redirect_domain}?teamId=${VERCEL_TEAM_ID}`
    await fetch(url, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    })
  }

  await supabase
    .from('brands')
    .update({ ooh_redirect_domain: null, ooh_redirect_domain_verified: false })
    .eq('id', brandId)

  revalidatePath('/dashboard/settings/ooh-domain')
  return { success: 'Custom domain removed.' }
}
