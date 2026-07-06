import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrand } from '@/lib/active-brand'

export const runtime = 'nodejs'

interface ProfileDraft {
  email?:               string
  phone?:               string
  name?:                string
  first_seen_at?:       string
  last_seen_at?:        string
  acquisition_source?:  string
  nps_score?:           number
  nps_label?:           string
  last_nps_at?:         string
  is_promoter?:         boolean
  total_orders?:        number
  total_spend?:         number
  sources:              Record<string, boolean>
}

function extractFromJsonb(obj: unknown): { email?: string; phone?: string; name?: string } {
  if (!obj || typeof obj !== 'object') return {}
  const o = obj as Record<string, unknown>
  const email = (typeof o.email === 'string' ? o.email : typeof o.respondent_email === 'string' ? o.respondent_email : undefined)?.toLowerCase().trim()
  const phone = typeof o.phone === 'string' ? o.phone.trim() : typeof o.mobile === 'string' ? o.mobile.trim() : undefined
  const name  = typeof o.name === 'string' ? o.name.trim() : typeof o.full_name === 'string' ? o.full_name.trim() : undefined
  return { email: email || undefined, phone: phone || undefined, name: name || undefined }
}

function npsLabel(score: number): string {
  if (score >= 9) return 'promoter'
  if (score >= 7) return 'passive'
  return 'detractor'
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brand = await getActiveBrand<{ id: string }>(supabase, 'id')
  if (!brand) return NextResponse.json({ error: 'No brand found' }, { status: 404 })

  const profileMap = new Map<string, ProfileDraft>() // key: email_lower or phone

  // ── 1. Survey responses (respondent_profile JSONB) ─────────────────────────
  const { data: surveys } = await supabase
    .from('survey_responses')
    .select('respondent_profile, collected_at')
    .order('collected_at', { ascending: true })

  for (const row of surveys ?? []) {
    const { email, phone, name } = extractFromJsonb(row.respondent_profile)
    const key = email ?? phone
    if (!key) continue

    const existing = profileMap.get(key) ?? { sources: {} }
    if (email && !existing.email) existing.email = email
    if (phone && !existing.phone) existing.phone = phone
    if (name  && !existing.name)  existing.name  = name
    if (!existing.first_seen_at || row.collected_at < existing.first_seen_at) {
      existing.first_seen_at = row.collected_at
      existing.acquisition_source = 'survey'
    }
    existing.last_seen_at = row.collected_at
    existing.sources.survey = true
    profileMap.set(key, existing)
  }

  // ── 2. WhatsApp contacts ───────────────────────────────────────────────────
  const { data: waContacts } = await supabase
    .from('whatsapp_contacts')
    .select('phone_e164, name, opted_in_at, created_at')
    .eq('brand_id', brand.id)
    .eq('whatsapp_opted_in', true)

  for (const c of waContacts ?? []) {
    const key = c.phone_e164
    if (!key) continue

    const existing = profileMap.get(key) ?? { sources: {} }
    if (!existing.phone) existing.phone = c.phone_e164
    if (c.name && !existing.name) existing.name = c.name
    const seenAt = c.opted_in_at ?? c.created_at
    if (!existing.first_seen_at || seenAt < existing.first_seen_at) {
      existing.first_seen_at = seenAt
      if (!existing.acquisition_source) existing.acquisition_source = 'whatsapp'
    }
    if (!existing.last_seen_at || seenAt > existing.last_seen_at) existing.last_seen_at = seenAt
    existing.sources.whatsapp = true
    profileMap.set(key, existing)
  }

  // ── 2b. Purchase events (Paystack / Flutterwave successful charges) ────────
  const { data: purchases } = await supabase
    .from('purchase_events')
    .select('customer_email, customer_phone, amount, source, occurred_at')
    .eq('brand_id', brand.id)
    .eq('status', 'success')
    .order('occurred_at', { ascending: true })

  for (const p of purchases ?? []) {
    const email = p.customer_email?.toLowerCase().trim() || undefined
    const phone = p.customer_phone?.trim() || undefined
    const key = email ?? phone
    if (!key) continue

    const existing = profileMap.get(key) ?? { sources: {} }
    if (email && !existing.email) existing.email = email
    if (phone && !existing.phone) existing.phone = phone
    if (!existing.first_seen_at || p.occurred_at < existing.first_seen_at) {
      existing.first_seen_at = p.occurred_at
      existing.acquisition_source = p.source
    }
    if (!existing.last_seen_at || p.occurred_at > existing.last_seen_at) existing.last_seen_at = p.occurred_at
    existing.sources.purchase = true
    existing.total_orders = (existing.total_orders ?? 0) + 1
    existing.total_spend  = (existing.total_spend ?? 0) + Number(p.amount ?? 0)
    profileMap.set(key, existing)
  }

  // ── 3. NPS records ─────────────────────────────────────────────────────────
  const { data: npsRecords } = await supabase
    .from('nps_records')
    .select('score, created_at')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })

  // NPS records don't have email/phone — we can only attach them to profiles
  // that already have an email/phone in the same segment-bucket.
  // For v1 we attach the most-recent NPS score to all profiles that are promoters
  // based on nps_records aggregate (best-effort: we can't link without identity).
  // We'll use this to compute brand-level NPS distribution separately.
  const latestNps = npsRecords?.[0]
  const hasNpsData = !!latestNps

  // ── 4. App reviews (name-only) ─────────────────────────────────────────────
  const { data: reviews } = await supabase
    .from('app_reviews')
    .select('author, rating, reviewed_at')
    .eq('brand_id', brand.id)
    .order('reviewed_at', { ascending: true })

  for (const r of reviews ?? []) {
    if (!r.author) continue
    // App reviews have no email/phone — only include if name already exists in profileMap
    // (can't deduplicate, so skip creating new profiles from reviews alone)
    for (const [, draft] of profileMap) {
      if (draft.name?.toLowerCase() === r.author.toLowerCase()) {
        if (!draft.sources.app_review) draft.sources.app_review = true
      }
    }
  }

  // ── 5. Get existing active promoters to link back ──────────────────────────
  const { data: existingPromoters } = await supabase
    .from('promoters')
    .select('id, email, phone, status')
    .eq('brand_id', brand.id)

  const promoterByEmail = new Map<string, string>()
  const promoterByPhone = new Map<string, string>()
  for (const p of existingPromoters ?? []) {
    if (p.email) promoterByEmail.set(p.email.toLowerCase(), p.id)
    if (p.phone) promoterByPhone.set(p.phone, p.id)
  }

  // ── 6. Merge all profiles (select-then-insert/update avoids partial-index conflict issues) ──
  const now = new Date().toISOString()
  let synced = 0

  for (const [, draft] of profileMap) {
    if (!draft.email && !draft.phone) continue

    const promoterId = draft.email
      ? promoterByEmail.get(draft.email.toLowerCase())
      : draft.phone ? promoterByPhone.get(draft.phone) : undefined

    const updates = {
      brand_id:           brand.id,
      email:              draft.email ?? null,
      phone:              draft.phone ?? null,
      name:               draft.name ?? null,
      first_seen_at:      draft.first_seen_at ?? now,
      last_seen_at:       draft.last_seen_at ?? now,
      acquisition_source: draft.acquisition_source ?? null,
      nps_score:          draft.nps_score ?? null,
      nps_label:          draft.nps_label ?? null,
      last_nps_at:        draft.last_nps_at ?? null,
      is_promoter:        !!promoterId,
      promoter_id:        promoterId ?? null,
      total_orders:       draft.total_orders ?? 0,
      total_spend:        draft.total_spend ?? 0,
      sources:            draft.sources,
      last_synced_at:     now,
      updated_at:         now,
    }

    // Try to find an existing profile by email, then phone
    let existingId: string | null = null
    if (draft.email) {
      const { data } = await supabase
        .from('customer_profiles')
        .select('id')
        .eq('brand_id', brand.id)
        .ilike('email', draft.email)
        .maybeSingle()
      existingId = data?.id ?? null
    }
    if (!existingId && draft.phone) {
      const { data } = await supabase
        .from('customer_profiles')
        .select('id')
        .eq('brand_id', brand.id)
        .eq('phone', draft.phone)
        .maybeSingle()
      existingId = data?.id ?? null
    }

    if (existingId) {
      await supabase.from('customer_profiles').update(updates).eq('id', existingId)
    } else {
      const { error } = await supabase.from('customer_profiles').insert(updates)
      if (error) console.error('[cdp/sync] insert error', error.message)
    }
    synced++
  }

  return NextResponse.json({
    ok: true,
    synced,
    sources_processed: {
      surveys:    (surveys?.length ?? 0),
      whatsapp:   (waContacts?.length ?? 0),
      purchases:  (purchases?.length ?? 0),
      nps:        (npsRecords?.length ?? 0),
      reviews:    (reviews?.length ?? 0),
    },
    has_nps_data:    hasNpsData,
    synced_at:       now,
  })
}
