import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'

// Normalise Nigerian phone numbers to E.164 (+2348012345678)
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length === 13) return '+' + digits
  if (digits.startsWith('0') && digits.length === 11) return '+234' + digits.slice(1)
  if (digits.length === 10) return '+234' + digits
  if (digits.startsWith('1') && digits.length === 11) return '+' + digits  // US
  if (digits.length >= 7 && digits.length <= 15) return '+' + digits
  return null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No active brand' }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Detect header row
  const hasHeader = lines[0]?.toLowerCase().includes('phone') ||
                    lines[0]?.toLowerCase().includes('number') ||
                    lines[0]?.toLowerCase().includes('name')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const contacts: { brand_id: string; phone_e164: string; name: string | null }[] = []
  const skipped: string[] = []

  for (const line of dataLines) {
    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''))
    // Detect which column is the phone number
    let phone = '', name = ''
    if (cols.length === 1) {
      phone = cols[0]
    } else {
      // Try to find the column that looks like a phone number
      const phoneIdx = cols.findIndex(c => /^[+0-9]/.test(c) && c.replace(/\D/g, '').length >= 7)
      if (phoneIdx === -1) { skipped.push(line); continue }
      phone = cols[phoneIdx]
      name = phoneIdx === 0 ? (cols[1] ?? '') : (cols[0] ?? '')
    }

    const normalised = normalisePhone(phone)
    if (!normalised) { skipped.push(line); continue }
    contacts.push({ brand_id: brandId, phone_e164: normalised, name: name || null })
  }

  if (contacts.length === 0) {
    return NextResponse.json({ error: 'No valid phone numbers found', skipped }, { status: 400 })
  }

  // Upsert — re-opt-in contacts who previously opted out if explicitly re-imported
  const { error } = await supabase
    .from('whatsapp_contacts')
    .upsert(contacts, { onConflict: 'brand_id,phone_e164', ignoreDuplicates: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ imported: contacts.length, skipped: skipped.length })
}
