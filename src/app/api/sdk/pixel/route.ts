import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveBrandId } from '@/lib/active-brand'

function buildSnippet(pixelId: string): string {
  return `;(function(w,d,s,id){
  w.__bp=w.__bp||{q:[],track:function(e,v,m){this.q.push({e,v,m,t:Date.now()})}};
  var el=d.createElement(s);
  el.async=1;
  el.src='https://brandpulse.ai/api/sdk/pixel.js';
  el.setAttribute('data-pixel-id',id);
  d.head.appendChild(el);
})(window,document,'script','${pixelId}');
// Track page view automatically
window.__bp.track('page_view',1,{url:location.href,ref:document.referrer});

// Simple alternative (no script tag needed):
// fetch('/api/sdk/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pixel_id:'${pixelId}',event_type:'page_view',page_url:location.href})});`
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand' }, { status: 404 })
  const brand = { id: brandId }

  const serviceClient = await createServiceClient()

  // Try to get existing pixel config, or create one
  let { data: pixelConfig } = await serviceClient
    .from('pixel_configs')
    .select('pixel_id')
    .eq('brand_id', brand.id)
    .single()

  if (!pixelConfig) {
    const { data: created, error: createError } = await serviceClient
      .from('pixel_configs')
      .insert({ brand_id: brand.id })
      .select('pixel_id')
      .single()

    if (createError || !created) {
      return NextResponse.json({ error: 'Failed to create pixel config' }, { status: 500 })
    }
    pixelConfig = created
  }

  return NextResponse.json({
    pixel_id: pixelConfig.pixel_id,
    snippet: buildSnippet(pixelConfig.pixel_id),
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = await getActiveBrandId(supabase)
  if (!brandId) return NextResponse.json({ error: 'No brand' }, { status: 404 })
  const brand = { id: brandId }

  const serviceClient = await createServiceClient()

  // Upsert — create if not exists, return existing if already present
  const { data: pixelConfig, error } = await serviceClient
    .from('pixel_configs')
    .upsert({ brand_id: brand.id }, { onConflict: 'brand_id', ignoreDuplicates: true })
    .select('pixel_id')
    .single()

  if (error || !pixelConfig) {
    // Upsert with ignoreDuplicates returns nothing on no-op — fetch instead
    const { data: existing } = await serviceClient
      .from('pixel_configs')
      .select('pixel_id')
      .eq('brand_id', brand.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Failed to get pixel config' }, { status: 500 })

    return NextResponse.json({
      pixel_id: existing.pixel_id,
      snippet: buildSnippet(existing.pixel_id),
    })
  }

  return NextResponse.json({
    pixel_id: pixelConfig.pixel_id,
    snippet: buildSnippet(pixelConfig.pixel_id),
  })
}
