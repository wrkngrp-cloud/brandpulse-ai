import { AlertTriangle, Target, BarChart2, CheckCircle2, TrendingUp, Zap } from 'lucide-react'

export default function GeoLiftPage() {
  const steps = [
    {
      num: 1,
      title: 'Define test & control markets',
      desc: 'Select a test region (e.g., Lagos) where the campaign will run, and a comparable control region (e.g., Abuja) that stays dark throughout.',
    },
    {
      num: 2,
      title: 'Run campaign in test market only',
      desc: 'Execute your campaign exclusively in the test market. BrandPulse tracks brand metrics in both markets in parallel from day one.',
    },
    {
      num: 3,
      title: 'Measure test vs control difference',
      desc: 'At campaign close, compare brand awareness, sentiment, and conversion metrics between test and control markets.',
    },
    {
      num: 4,
      title: 'Calculate incremental lift',
      desc: 'Net incremental lift = (test uplift) minus (control uplift). What remains after removing organic baseline is your true campaign impact.',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Coming soon banner */}
      <div className="flex items-start gap-3 border border-amber-200 rounded-xl p-4 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Coming Soon — in active development</p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
            Geo-Lift Studies is being built for the next platform release. The overview below explains exactly how it will work.
          </p>
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Geo-Lift Studies</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Measure true incremental impact of campaigns by region
        </p>
      </div>

      {/* What is Geo-Lift */}
      <div className="border rounded-xl p-5 bg-card space-y-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">What is a Geo-Lift Study?</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Geo-Lift studies measure whether your marketing spend actually caused sales uplift — not just correlation. By running campaigns in test regions while holding control regions dark, BrandPulse can isolate your brand's true incremental lift above organic baseline.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Without geo-lift, it's impossible to know if your Lagos campaign drove brand growth or if awareness was rising anyway due to word of mouth, press coverage, or seasonal demand. Geo-lift gives you the causal answer.
        </p>
      </div>

      {/* How it works */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {steps.map(step => (
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

      {/* Demo results */}
      <div className="border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Sample Geo-Lift Result</h2>
          <span className="text-xs text-muted-foreground ml-auto">Jara Foods · Q2 2025 Lagos Campaign</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Test market */}
          <div className="border rounded-xl p-4 space-y-3 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Test Market</span>
              <span className="text-sm font-semibold">Lagos</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Brand Awareness</p>
                <p className="text-base font-bold text-green-700 dark:text-green-400">+14%</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Sentiment</p>
                <p className="text-base font-bold text-green-700 dark:text-green-400">+8pts</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Conv. Lift</p>
                <p className="text-base font-bold text-green-700 dark:text-green-400">+6.2%</p>
              </div>
            </div>
          </div>

          {/* Control market */}
          <div className="border rounded-xl p-4 space-y-3 bg-muted/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Control Market</span>
              <span className="text-sm font-semibold">Abuja</span>
              <span className="text-xs text-muted-foreground ml-auto">(organic baseline)</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Brand Awareness</p>
                <p className="text-base font-bold">+2%</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Sentiment</p>
                <p className="text-base font-bold">+1pt</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Conv. Lift</p>
                <p className="text-base font-bold">+0.4%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Net incremental lift */}
        <div className="border rounded-xl p-4 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Net Incremental Lift</p>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">94% statistical confidence</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Awareness lift (net)</p>
              <p className="text-lg font-bold text-primary">+12%</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Conversion lift (net)</p>
              <p className="text-lg font-bold text-primary">+5.8%</p>
            </div>
          </div>
        </div>
      </div>

      {/* How this feeds BHI */}
      <div className="border rounded-xl p-5 bg-card space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">How Geo-Lift feeds your Brand Health Index</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Geo-lift results feed the Brand Health Index by providing causal evidence of campaign effectiveness, improving the accuracy of the SOV and Sentiment components. Rather than estimating campaign contribution from correlation alone, BHI can apply verified incremental lift values directly — making the index a more honest signal of your brand's true health trajectory.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When a geo-lift study concludes, BrandPulse automatically tags the campaign's contribution to BHI and adjusts future attribution weights based on what worked in which region.
        </p>
      </div>
    </div>
  )
}
