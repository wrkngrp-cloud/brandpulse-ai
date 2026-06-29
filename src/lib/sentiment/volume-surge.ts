import type { SupabaseClient } from '@supabase/supabase-js'

export interface VolumeSurgeResult {
  brand_id:         string
  yesterday_negative: number
  baseline_mean:    number
  baseline_stddev:  number
  z_score:          number
  alert_fired:      boolean
  skipped?:         boolean
  reason?:          string
}

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Computes the z-score of yesterday's negative mention volume against the
 * trailing 30-day daily baseline, and fires a notification when it crosses 2σ.
 *
 * The mentions table stores raw rows (sentiment_label, created_at) — there is
 * no per-day negative_count rollup — so we bucket the rows by calendar day in
 * JS. Days with zero negatives count as 0 in the baseline (important for std).
 */
export async function runVolumeSurgeCheck(
  supabase: SupabaseClient,
  brand: { id: string; name: string | null },
): Promise<VolumeSurgeResult> {
  const now = new Date()
  // Midnight boundaries (UTC) for clean day buckets.
  const todayStart     = new Date(`${dayKey(now)}T00:00:00.000Z`)
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS)
  // 30 full baseline days before yesterday.
  const baselineStart  = new Date(yesterdayStart.getTime() - 30 * DAY_MS)
  const yesterdayKey   = dayKey(yesterdayStart)

  const base: VolumeSurgeResult = {
    brand_id:           brand.id,
    yesterday_negative: 0,
    baseline_mean:      0,
    baseline_stddev:    0,
    z_score:            0,
    alert_fired:        false,
  }

  // Readiness gate: need at least 7 days of aggregate history.
  const { count: dailyCount } = await supabase
    .from('sentiment_daily')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brand.id)
    .gte('day', dayKey(baselineStart))
  if ((dailyCount ?? 0) < 7) {
    return { ...base, skipped: true, reason: 'Insufficient baseline data' }
  }

  // Pull every negative mention across the baseline window + yesterday.
  const { data: negMentions } = await supabase
    .from('mentions')
    .select('created_at')
    .eq('brand_id', brand.id)
    .eq('sentiment_label', 'negative')
    .gte('created_at', baselineStart.toISOString())
    .lt('created_at', todayStart.toISOString())

  // Bucket negatives by calendar day.
  const buckets: Record<string, number> = {}
  for (const m of negMentions ?? []) {
    const key = dayKey(new Date(m.created_at as string))
    buckets[key] = (buckets[key] ?? 0) + 1
  }

  // Build the 30 baseline day keys (yesterday excluded) and fill zeros.
  const counts: number[] = []
  for (let i = 30; i >= 1; i--) {
    const key = dayKey(new Date(yesterdayStart.getTime() - i * DAY_MS))
    counts.push(buckets[key] ?? 0)
  }

  const currentNeg = buckets[yesterdayKey] ?? 0
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length
  const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length
  const stdDev = Math.sqrt(variance)
  const zScore = stdDev > 0 ? (currentNeg - mean) / stdDev : 0

  const fired = zScore >= 2.0

  if (fired) {
    // Dedupe: only one volume-surge alert per brand per day.
    const { data: existingAlert } = await supabase
      .from('notifications')
      .select('id')
      .eq('brand_id', brand.id)
      .eq('type', 'sentiment_alert')
      .eq('alert_subtype', 'volume_surge')
      .gte('created_at', todayStart.toISOString())
      .limit(1)
      .maybeSingle()

    if (!existingAlert) {
      await supabase.from('notifications').insert({
        brand_id:       brand.id,
        type:           'sentiment_alert',
        title:          'Complaint volume surge detected',
        body:           `Negative mentions are ${zScore.toFixed(1)}σ above your 30-day average. ${currentNeg} negative mentions yesterday vs a baseline of ${Math.round(mean)}/day. Check what's driving the spike.`,
        href:           '/dashboard/sentiment',
        alert_subtype:  'volume_surge',
        baseline_value: mean,
        current_value:  currentNeg,
        z_score:        zScore,
      })
    }
  }

  return {
    brand_id:           brand.id,
    yesterday_negative: currentNeg,
    baseline_mean:      mean,
    baseline_stddev:    stdDev,
    z_score:            zScore,
    alert_fired:        fired,
  }
}
