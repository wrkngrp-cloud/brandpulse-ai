/**
 * The shape of a Monday Brief. No imports, so the demo generators (which
 * compile standalone in npm run demo:check) can build one too.
 */
export type CauseLabel = 'moved_together' | 'tested' | 'no_clear_cause'

export interface BriefSource { id: string; kind: string; title: string; date: string; url?: string }

export interface BriefContent {
  weekStart:  string
  weekLabel:  string
  metric: {
    key: string; label: string; isIndex: boolean
    value: number; previous: number; changePct: number | null
    history: { week: string; value: number }[]
  }
  headline:   string
  summary:    string
  causes:     { text: string; label: CauseLabel; sources: BriefSource[] }[]
  watchNext:  string | null
  counts:     { campaigns: number; moments: number; press: number; competitorMoves: number }
  generatedAt: string
}

export interface NeedsNumbers {
  weekStart: string
  weekLabel: string
  metric:    { key: string; label: string; question: string }
  missing:   'last_week' | 'week_before'
}

