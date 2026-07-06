import { AlertCircle, CheckCircle2, Briefcase } from 'lucide-react'
import { callAi } from '@/lib/ai/client'

// SectionHead from business-case-client.tsx is a Client Component that
// takes an `icon` component-type prop — Server Components can't pass a
// function reference like that across the RSC boundary into a Client
// Component ("Functions cannot be passed directly to Client Components"),
// so this heading is duplicated inline rather than imported.
function SectionHead({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <Icon className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
      <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{children}</h2>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

// This is its own async Server Component, rendered inside a <Suspense>
// boundary by the page, specifically so the board-grade AI call (a real
// LLM round trip) never blocks the rest of the page — which is otherwise
// all fast Supabase queries — from rendering. Board Pack has no AI call
// in its critical path and loads immediately; Business Case used to block
// on this exact call before streaming anything.

interface AiBusinessCase {
  headline:     string
  case:         string
  roi_argument: string
  risks:        string[]
  asks:         { amount: string; channel: string; rationale: string }[]
  proof_points: string[]
}

interface Props {
  brandName:      string
  brandCategory:  string | null
  currentBhi:     number | null
  bhiChange:      number | null
  sov:            number | null
  marketShare:    number | null
  esov:           number | null
  avgSentiment:   number | null
  avgNps:         number | null
  npsCount:       number
  mentions30d:    number
  totalSpend:     number
  totalBudget:    number
  activeCampaigns: number
  competitors:    string[]
  commercialLines: string[]
}

async function generateBusinessCase(props: Props): Promise<AiBusinessCase | null> {
  try {
    const {
      brandName, brandCategory, currentBhi, bhiChange, sov, marketShare, esov,
      avgSentiment, avgNps, npsCount, mentions30d, totalSpend, totalBudget,
      activeCampaigns, competitors, commercialLines,
    } = props

    const bhiTrendStr = bhiChange != null
      ? `${bhiChange > 0 ? '+' : ''}${bhiChange.toFixed(1)} pts over 90 days`
      : 'trend data unavailable'

    const prompt = `You are a seasoned Chief Marketing Officer preparing a business case to justify and expand the marketing budget.

Brand: ${brandName} (${brandCategory ?? 'Consumer brand'}, Nigeria)
Period: Last 90 days

PERFORMANCE DATA:
- Brand Health Index: ${currentBhi != null ? `${currentBhi.toFixed(1)}/100` : 'N/A'} (${bhiTrendStr})
- Share of Voice: ${sov != null ? `${sov.toFixed(1)}%` : 'N/A'}
- Market Share: ${marketShare != null ? `${marketShare}%` : 'N/A'}
- ESOV (SOV minus market share): ${esov != null ? (esov > 0 ? '+' : '') + esov.toFixed(1) + '%' : 'N/A'}
- Avg Sentiment: ${avgSentiment != null ? avgSentiment.toFixed(1) : 'N/A'}/100
- NPS: ${avgNps != null ? avgNps.toFixed(1) : 'N/A'} (${npsCount} responses)
- Brand mentions (30d): ${mentions30d}
- Total media spend (90d): ₦${totalSpend.toLocaleString()}
- Total budget (90d): ₦${totalBudget.toLocaleString()}
- Active campaigns: ${activeCampaigns}
- Tracked competitors: ${competitors.join(', ') || 'none yet'}
${commercialLines.length > 0 ? commercialLines.join('\n') + '\n' : ''}
Use the Les Binet & Peter Field ESOV model (positive ESOV predicts market share growth), Aaker's brand equity framework, and hard numbers from the data above.

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "headline": "one-sentence business case headline (under 15 words)",
  "case": "2-3 sentence executive summary making the investment case. Plain English, no jargon.",
  "roi_argument": "1-2 sentences on why this spend generates return, using the data above. Cite specific numbers.",
  "risks": ["risk 1 if budget NOT approved", "risk 2", "risk 3"],
  "asks": [
    {"amount": "₦X", "channel": "channel name", "rationale": "one sentence why this channel"},
    {"amount": "₦X", "channel": "channel name", "rationale": "..."},
    {"amount": "₦X", "channel": "channel name", "rationale": "..."}
  ],
  "proof_points": ["data point 1", "data point 2", "data point 3"]
}

Budget ask amounts should be directional, based on the existing spend pattern. Keep all items under 20 words each.`

    const raw = await callAi({
      tier:      'boardGrade',
      system:    'You produce board-grade marketing investment cases backed by real data. JSON only, no commentary.',
      messages:  [{ role: 'user', content: prompt }],
      maxTokens: 1200,
    })

    // Robust JSON extraction: find the outermost { … } regardless of any
    // wrapping text, same pattern used by api/ai/business-case/route.ts —
    // guards against stray preamble/fences, not just truncation.
    const start = raw.indexOf('{')
    const end   = raw.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      console.error('[business-case] No JSON object found in AI response. Raw (500):', raw.slice(0, 500))
      return null
    }
    return JSON.parse(raw.slice(start, end + 1))
  } catch (err) {
    console.error('[business-case] AI executive brief generation failed:', err)
    return null
  }
}

export async function AiExecutiveBrief(props: Props) {
  const aiBusinessCase = await generateBusinessCase(props)

  if (!aiBusinessCase) {
    return (
      <div className="rounded-2xl border bg-muted/30 px-5 py-4 flex items-center gap-3 text-[13px] text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
        <span>AI executive brief could not be generated — your brand data is all here, but there was not enough historical data to produce a board-ready narrative yet. Try again once you have at least 4 weeks of campaign and sentiment data.</span>
      </div>
    )
  }

  return (
    <section>
      <SectionHead icon={Briefcase}>Executive Brief</SectionHead>
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="bg-primary/8 border-b px-5 py-4">
          <p className="text-[15px] font-bold leading-snug">{aiBusinessCase.headline}</p>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[13.5px] leading-relaxed">{aiBusinessCase.case}</p>
          <div className="rounded-xl bg-muted/40 px-4 py-3">
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-1">ROI Argument</p>
            <p className="text-[13px] leading-relaxed">{aiBusinessCase.roi_argument}</p>
          </div>

          {/* Proof points */}
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Proof Points</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {aiBusinessCase.proof_points.map((p, i) => (
                <div key={i} className="rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mb-1" />
                  <p className="text-[12px] text-emerald-800 dark:text-emerald-300">{p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Budget asks */}
          {aiBusinessCase.asks.length > 0 && (
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Budget Ask</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {aiBusinessCase.asks.map((a, i) => (
                  <div key={i} className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-[18px] font-bold text-primary">{a.amount}</p>
                    <p className="text-[12px] font-semibold capitalize">{a.channel}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk if not approved */}
          <div className="border-t pt-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Risks if Budget is Not Approved</p>
            <ul className="space-y-1.5">
              {aiBusinessCase.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
