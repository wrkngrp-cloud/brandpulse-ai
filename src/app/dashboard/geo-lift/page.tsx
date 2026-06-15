import { createClient }        from '@/lib/supabase/server'
import { redirect }            from 'next/navigation'
import { Target, BarChart2, TrendingUp, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { GeoLiftStartForm }    from './geo-lift-start-form'

interface GeoLiftStudy {
  id:                 string
  treatment_city:     string
  control_city:       string
  keyword:            string
  study_start:        string
  study_end:          string
  lift_pct:           number | null
  confidence:         number | null
  correlation:        number | null
  ai_interpretation:  string | null
  status:             string
  weekly_data:        WeeklyPoint[] | null
  campaign_id:        string | null
}

interface WeeklyPoint {
  week:            string
  treatment_index: number
  control_index:   number
}

const STATUS_LABEL: Record<string, string> = {
  pending:           'Queued',
  running:           'Running',
  complete:          'Complete',
  insufficient_data: 'Needs more data',
}

const STATUS_STYLE: Record<string, string> = {
  pending:           'bg-muted text-muted-foreground',
  running:           'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  complete:          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  insufficient_data: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'running')           return <Loader2 className="h-3.5 w-3.5 animate-spin" />
  if (status === 'complete')          return <CheckCircle2 className="h-3.5 w-3.5" />
  if (status === 'insufficient_data') return <AlertCircle className="h-3.5 w-3.5" />
  return <Clock className="h-3.5 w-3.5" />
}

function StudyCard({ study }: { study: GeoLiftStudy }) {
  const maxVal = study.weekly_data?.length
    ? Math.max(...study.weekly_data.flatMap(w => [w.treatment_index, w.control_index]), 1)
    : 1

  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[study.status] ?? STATUS_STYLE.pending}`}>
              <StatusIcon status={study.status} />
              {STATUS_LABEL[study.status] ?? study.status}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(study.study_start).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              {' — '}
              {new Date(study.study_end).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <h3 className="text-sm font-semibold">
            &ldquo;{study.keyword}&rdquo; · {study.treatment_city} vs {study.control_city}
          </h3>
        </div>
      </div>

      {/* Results KPIs */}
      {study.status === 'complete' && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Search Lift</p>
            <p className={`text-lg font-bold tabular-nums ${(study.lift_pct ?? 0) > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
              {study.lift_pct !== null ? `${study.lift_pct > 0 ? '+' : ''}${study.lift_pct.toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Correlation</p>
            <p className="text-lg font-bold tabular-nums">
              {study.correlation !== null ? study.correlation.toFixed(2) : '—'}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="text-lg font-bold tabular-nums">
              {study.confidence !== null ? `${study.confidence.toFixed(0)}%` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Mini chart — CSS bar sparklines */}
      {study.weekly_data && study.weekly_data.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Weekly search interest</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-24 shrink-0">{study.treatment_city}</span>
              <div className="flex-1 flex items-end gap-0.5 h-8">
                {study.weekly_data.map((w, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/70 rounded-sm"
                    style={{ height: `${Math.max(3, (w.treatment_index / maxVal) * 32)}px` }}
                    title={`Week ${w.week}: ${w.treatment_index}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-24 shrink-0">{study.control_city}</span>
              <div className="flex-1 flex items-end gap-0.5 h-8">
                {study.weekly_data.map((w, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-muted-foreground/40 rounded-sm"
                    style={{ height: `${Math.max(3, (w.control_index / maxVal) * 32)}px` }}
                    title={`Week ${w.week}: ${w.control_index}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{study.weekly_data.length} weeks of data</span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-primary/70" />{study.treatment_city}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-muted-foreground/40" />{study.control_city}
            </span>
          </div>
        </div>
      )}

      {/* AI interpretation */}
      {study.ai_interpretation && (
        <div className="rounded-lg bg-muted/30 border p-3 text-sm text-muted-foreground leading-relaxed">
          {study.ai_interpretation}
        </div>
      )}

      {study.status === 'insufficient_data' && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Not enough weekly data points to calculate lift with confidence. Try extending the study period or choosing a broader keyword.
        </p>
      )}
    </div>
  )
}

export default async function GeoLiftPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .limit(1)
    .single()

  if (!brand) redirect('/dashboard')

  const [{ data: studies }, { data: campaigns }] = await Promise.all([
    supabase
      .from('geo_lift_studies')
      .select('id, treatment_city, control_city, keyword, study_start, study_end, lift_pct, confidence, correlation, ai_interpretation, status, weekly_data, campaign_id')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('campaigns')
      .select('id, name')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false }),
  ])

  const hasStudies = (studies ?? []).length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Geo-Lift Studies</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Measure true incremental impact of campaigns by city
        </p>
      </div>

      {hasStudies ? (
        <>
          <div className="space-y-4">
            {(studies ?? []).map(study => (
              <StudyCard key={study.id} study={study as GeoLiftStudy} />
            ))}
          </div>

          <div className="border rounded-xl p-5 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Start another study</h3>
            </div>
            <GeoLiftStartForm
              brandId={brand.id}
              brandName={brand.name}
              campaigns={campaigns ?? []}
            />
          </div>
        </>
      ) : (
        <>
          <div className="border rounded-xl p-5 bg-card space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">What is a Geo-Lift Study?</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Geo-Lift studies measure whether your marketing spend actually caused brand search uplift, not just correlation. By running campaigns in test cities while holding control cities dark, BrandPulse isolates your brand&apos;s true incremental lift above the organic baseline.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Without geo-lift, it&apos;s impossible to know if your Lagos campaign drove brand growth or if awareness was rising anyway due to word of mouth, press coverage, or seasonal demand. Geo-lift gives you the causal answer.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">How it works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { num: 1, title: 'Choose test and control cities', desc: 'Select a city where the campaign will run and a comparable city that stays dark throughout.' },
                { num: 2, title: 'Set a branded keyword', desc: 'BrandPulse tracks Google search interest for the keyword in both cities week by week.' },
                { num: 3, title: 'Compare weekly search trends', desc: 'Google Trends data is pulled for both cities and indexed, then compared side by side.' },
                { num: 4, title: 'Calculate net incremental lift', desc: 'Lift = (mean treatment index - mean control index) / mean control. What remains is your true campaign impact.' },
              ].map(step => (
                <div key={step.num} className="border rounded-xl p-5 bg-card space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {step.num}
                    </span>
                    <p className="text-sm font-semibold">{step.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-xl p-5 bg-card space-y-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Sample Result</h2>
              <span className="text-xs text-muted-foreground ml-auto">Illustrative, not real data</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border rounded-xl p-4 space-y-3 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Treatment</span>
                  <span className="text-sm font-semibold">Lagos</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">+18%</p>
                <p className="text-xs text-muted-foreground">branded search interest</p>
              </div>
              <div className="border rounded-xl p-4 space-y-3 bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Control</span>
                  <span className="text-sm font-semibold">Abuja</span>
                  <span className="text-xs text-muted-foreground ml-auto">organic baseline</span>
                </div>
                <p className="text-2xl font-bold">+4%</p>
                <p className="text-xs text-muted-foreground">branded search interest</p>
              </div>
            </div>
            <div className="border rounded-xl p-4 bg-primary/5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">Net incremental lift</p>
                <p className="text-2xl font-bold text-primary">+13.5%</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                89% statistical confidence
              </div>
            </div>
          </div>

          <div className="border rounded-xl p-5 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Start your first study</h3>
            </div>
            <GeoLiftStartForm
              brandId={brand.id}
              brandName={brand.name}
              campaigns={campaigns ?? []}
            />
          </div>
        </>
      )}
    </div>
  )
}
