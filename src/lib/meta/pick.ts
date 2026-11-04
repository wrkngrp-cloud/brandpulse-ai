import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/crypto'
import { getInstagramAccount } from '@/lib/social/meta'

/**
 * Choosing which Page or ad account to connect.
 *
 * A Meta login can manage several Facebook Pages and several ad accounts. The
 * connect flows used to take the first one Meta listed, so an agency or a
 * marketer with two brands could connect the wrong brand without being told,
 * and every number after that belonged to someone else. When there is more
 * than one, the login is held here for ten minutes, encrypted, and the
 * person picks.
 */

const GRAPH = 'https://graph.facebook.com/v21.0'
const TTL = 600

export type PickKind = 'facebook' | 'instagram' | 'meta_ads'

export interface PickOption { id: string; name: string; note?: string }

interface PendingPick {
  kind:        PickKind
  userId:      string        // the BrandGauge user who started the connect
  brandId:     string
  token:       string        // encrypted Meta user token
  expiresAt:   string | null
  metaUserId:  string | null
  options:     PickOption[]
  returnTo?:   string
}

const redis = () => new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })

export async function holdPick(p: Omit<PendingPick, 'token'> & { accessToken: string }): Promise<string> {
  const key = randomBytes(16).toString('hex')
  const { accessToken, ...rest } = p
  await redis().set(`meta-pick:${key}`, { ...rest, token: encrypt(accessToken) }, { ex: TTL })
  return key
}

/** What the chooser screen may show: the kind and the names. Never the token. */
export async function readPick(key: string, userId: string): Promise<{ kind: PickKind; options: PickOption[] } | null> {
  const p = await redis().get<PendingPick>(`meta-pick:${key}`).catch(() => null)
  if (!p || p.userId !== userId) return null
  return { kind: p.kind, options: p.options }
}

export type FinishOutcome =
  | { ok: true; kind: PickKind; returnTo?: string }
  | { ok: false; error: string }

/** Connect the one they chose. Only an id that was offered is accepted. */
export async function finishPick(db: SupabaseClient, key: string, userId: string, optionId: string): Promise<FinishOutcome> {
  const p = await redis().get<PendingPick>(`meta-pick:${key}`).catch(() => null)
  if (!p || p.userId !== userId) return { ok: false, error: 'That choice has expired. Connect again from the Connectors page.' }
  const option = p.options.find(o => o.id === optionId)
  if (!option) return { ok: false, error: 'Pick one of the accounts listed.' }
  const token = decrypt(p.token)
  const now = new Date().toISOString()

  if (p.kind === 'meta_ads') {
    const res = await fetch(`${GRAPH}/${option.id}?fields=name,currency&access_token=${token}`)
    const acct = await res.json().catch(() => ({})) as { name?: string; currency?: string; error?: unknown }
    if (!res.ok || acct.error) return { ok: false, error: 'Meta did not let us read that ad account. Check you have access to it, then try again.' }
    await db.from('digital_ad_accounts').delete().eq('brand_id', p.brandId).eq('platform', 'meta').eq('auth_mode', 'shared')
    const { error } = await db.from('digital_ad_accounts').upsert({
      brand_id: p.brandId, platform: 'meta', account_id: option.id, ad_account_id: option.id,
      account_name: acct.name ?? option.name, access_token: encrypt(token), token_expiry: p.expiresAt,
      meta_user_id: p.metaUserId, currency: acct.currency ?? 'NGN', sync_status: 'active', updated_at: now,
    }, { onConflict: 'brand_id,platform,account_id' })
    if (error) return { ok: false, error: 'We could not save the connection. Try again.' }
  } else {
    // A Page token, fetched now with the user token rather than held in Redis.
    const res = await fetch(`${GRAPH}/${option.id}?fields=id,name,access_token&access_token=${token}`)
    const page = await res.json().catch(() => ({})) as { id?: string; name?: string; access_token?: string }
    if (!res.ok || !page.access_token) return { ok: false, error: 'Meta did not let us read that Page. Check you manage it, then try again.' }

    let row: Record<string, unknown>
    if (p.kind === 'facebook') {
      row = { platform: 'facebook', account_id: page.id, account_name: page.name, access_token: encrypt(page.access_token) }
    } else {
      const ig = await getInstagramAccount(page.access_token, option.id).catch(() => null)
      const igId = ig?.instagram_business_account?.id
      if (!igId) return { ok: false, error: `${page.name ?? 'That Page'} has no linked Instagram Business account. Link one in Meta Business Settings, or pick another Page.` }
      // The Instagram media endpoints read with the user token.
      row = { platform: 'instagram', account_id: igId, account_name: page.name, access_token: encrypt(token) }
    }
    const { error } = await db.from('social_connections').upsert({
      ...row, brand_id: p.brandId, meta_user_id: p.metaUserId, token_expires_at: p.expiresAt,
      sync_status: 'active', connected_at: now,
    }, { onConflict: 'brand_id,platform,account_id' })
    if (error) return { ok: false, error: 'We could not save the connection. Try again.' }
  }

  await redis().del(`meta-pick:${key}`).catch(() => { /* expires anyway */ })
  return { ok: true, kind: p.kind, returnTo: p.returnTo }
}
