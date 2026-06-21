import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getActiveBrandId(supabase: SupabaseClient): Promise<string | null> {
  const cookieStore = await cookies()
  const stored = cookieStore.get('active_brand_id')?.value

  if (stored) {
    const { data } = await supabase.from('brands').select('id').eq('id', stored).maybeSingle()
    if (data) return data.id
  }

  const { data } = await supabase.from('brands').select('id').limit(1).maybeSingle()
  return data?.id ?? null
}

export async function getActiveBrand<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  selectCols: string,
): Promise<T | null> {
  const cookieStore = await cookies()
  const stored = cookieStore.get('active_brand_id')?.value

  if (stored) {
    const { data } = await supabase.from('brands').select(selectCols).eq('id', stored).maybeSingle()
    if (data) return data as unknown as T
  }

  const { data } = await supabase.from('brands').select(selectCols).limit(1).maybeSingle()
  return (data as unknown as T) ?? null
}
