import { NextRequest, NextResponse } from 'next/server'
import { callAi, extractJson } from '@/lib/ai/client'
import { createClient } from '@/lib/supabase/server'

export const runtime    = 'nodejs'
export const maxDuration = 30

interface BrandInferRequest {
  brandName: string
  websiteUrl?: string
}

export interface BrandInferResult {
  category: string
  brandValues: string[]
  brandVoice: {
    adjectives: string[]
    tone: string
    dos: string[]
    donts: string[]
    signaturePhrases: string[]
  }
  culturalProfile: {
    community_corporate: number
    traditional_modern: number
    religious_secular: number
    mass_premium: number
    local_global: number
  }
  targetSegments: Array<{ name: string; demographics: string; geography: string }>
  confidence: 'High' | 'Medium' | 'Low'
  inferenceSources: string[]
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)
}

async function scrapeWebsite(url: string): Promise<string | null> {
  try {
    const normalised = url.startsWith('http') ? url : `https://${url}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(normalised, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BrandGauge/1.0 (brand intelligence platform)' },
    })
    clearTimeout(timeout)
    if (!res.ok) {
      console.warn(`[brand-infer] scrape of ${normalised} returned ${res.status}`)
      return null
    }
    const html = await res.text()
    const text = stripHtml(html)
    if (!text) console.warn(`[brand-infer] scrape of ${normalised} yielded no text`)
    return text || null
  } catch (err) {
    /* Silently returning null meant a site that blocks our user agent, times
       out, or renders entirely client-side was indistinguishable from one
       with nothing to say. The profile still comes back, drawn from the brand
       name alone and marked low confidence, which is the "website search did
       not work" symptom seen from the outside. */
    const why = err instanceof Error ? err.message : String(err)
    console.warn(`[brand-infer] scrape of ${url} failed: ${why}`)
    return null
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as BrandInferRequest
  if (!body.brandName?.trim()) {
    return NextResponse.json({ error: 'Brand name is required' }, { status: 400 })
  }

  const inferenceSources: string[] = ['brand_name']
  const parts: string[] = [`Brand name: ${body.brandName}`]

  // Scrape website if URL provided
  if (body.websiteUrl?.trim()) {
    const websiteText = await scrapeWebsite(body.websiteUrl.trim())
    if (websiteText) {
      parts.push(`\nWebsite homepage extract:\n"""${websiteText}"""`)
      inferenceSources.push('website')
    }
  }

  const userMessage = parts.join('\n') +
    '\n\nInfer the brand profile from the above. Use every source available. ' +
    'Where a source contradicts another, prefer the most recent and most explicit signal.'

  const system = `You are a brand analyst specialising in Nigerian and West African markets. Given whatever public-facing information is available for a brand, infer its profile accurately and honestly. Where you have strong evidence from content, score confidence High. Where you are inferring from the brand name alone, score confidence Low and make that visible. Do not invent signature phrases that are not present in the source content.

You MUST return ONLY valid JSON in this exact shape — no preamble, no markdown fences:
{
  "category": "",
  "brandValues": [],
  "brandVoice": {
    "adjectives": [],
    "tone": "",
    "dos": [],
    "donts": [],
    "signaturePhrases": []
  },
  "culturalProfile": {
    "community_corporate": 50,
    "traditional_modern": 50,
    "religious_secular": 50,
    "mass_premium": 50,
    "local_global": 50
  },
  "targetSegments": [
    { "name": "", "demographics": "", "geography": "" }
  ],
  "confidence": "High",
  "inferenceSources": []
}

category must be exactly one of: Fintech, FMCG, Telco, Fashion & Apparel, Healthcare, Education, Entertainment & Media, Retail, Real Estate, Logistics, Food & Beverage, Automotive, Other.
culturalProfile values are integers 0-100.
confidence must be exactly "High", "Medium", or "Low".
inferenceSources must be an array using only these values: "brand_name", "website", "twitter_bio", "twitter_posts", "instagram_bio", "instagram_posts".`

  /* Was a hand-rolled Anthropic client with the model id written out here.
     CLAUDE.md is explicit that our AI calls go through callAi and that model
     ids live in one place, and a second copy is exactly how a tier silently
     drifts. Routed through the structural tier now, which is what a report or
     a structured inference is. */
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[brand-infer] ANTHROPIC_API_KEY is not set in this environment')
    return NextResponse.json({ error: 'ai_not_configured' }, { status: 503 })
  }

  try {
    const raw = await callAi({
      tier: 'structural',
      system,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1200,
      temperature: 0.1,
    })
    const parsed = extractJson<BrandInferResult>(raw)

    // Merge actual sources used (API may report fewer than we passed)
    parsed.inferenceSources = [...new Set([...inferenceSources, ...(parsed.inferenceSources ?? [])])]

    return NextResponse.json(parsed)
  } catch (err) {
    /* The old catch was bare: no logging, no distinction, always a 502. That
       is why a failure here is indistinguishable from a wrong environment
       from the outside, which is the position this bug was reported from. */
    const message = err instanceof Error ? err.message : String(err)
    console.error('[brand-infer] inference failed:', message)
    const auth = /401|invalid.*api.?key|authentication/i.test(message)
    return NextResponse.json(
      { error: auth ? 'ai_not_configured' : 'inference_failed', detail: message.slice(0, 300) },
      { status: auth ? 503 : 502 },
    )
  }
}
