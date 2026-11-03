import type { BriefContent } from '@/lib/brief/build'

/**
 * One brief, read-only. A server component with no hooks, so the dashboard
 * and the public /brief/<token> page render exactly the same thing.
 */
const LABEL: Record<BriefContent['causes'][number]['label'], string> = {
  moved_together: 'Moved together, not tested',
  tested:         'Tested',
  no_clear_cause: 'No clear cause',
}

export function BriefView({ content, brandName, publicView = false }: { content: BriefContent; brandName?: string; publicView?: boolean }) {
  const { metric } = content
  const change = metric.changePct
  const sign = change == null ? '' : change > 0 ? '+' : change < 0 ? '−' : ''
  return (
    <article className="space-y-4">
      <div className="space-y-1">
        <p className="bg-label text-[0.7rem] text-tx-3">Monday Brief · {content.weekLabel}{brandName ? ` · ${brandName}` : ''}</p>
        <h2 className="text-lg font-medium leading-snug">{content.headline}</h2>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-sm text-tx-2">{metric.label}</p>
        {change != null && <p className="bg-num text-2xl">{sign}{Math.abs(change)}%</p>}
        {!metric.isIndex && (
          <p className="text-sm text-tx-2">
            <span className="bg-num">{metric.value.toLocaleString('en-NG')}</span>, from <span className="bg-num">{metric.previous.toLocaleString('en-NG')}</span>
          </p>
        )}
      </div>

      {metric.history.length > 2 && (
        <ol className="flex flex-wrap gap-3 text-xs text-tx-3" aria-label="Recent weeks">
          {metric.history.slice(-6).map(h => (
            <li key={h.week}><span className="bg-num text-tx-2">{h.value.toLocaleString('en-NG')}</span> <span>wk of {h.week.slice(5)}</span></li>
          ))}
        </ol>
      )}

      <p className="text-sm leading-relaxed">{content.summary}</p>

      {content.causes.length > 0 && (
        <div className="space-y-2">
          <p className="bg-label text-[0.7rem] text-tx-3">What moved with it</p>
          <ul className="space-y-3">
            {content.causes.map((c, i) => (
              <li key={i} className="space-y-1">
                <p className="text-sm">{c.text}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-tx-2">
                  <span className="rounded-full border border-line px-2 py-0.5">{LABEL[c.label]}</span>
                  {c.sources.map(s => s.url && !(publicView && s.url.startsWith('/'))
                    ? <a key={s.id} href={s.url} target={s.url.startsWith('/') ? undefined : '_blank'} rel="noreferrer" className="underline underline-offset-2">{s.title.slice(0, 80)}</a>
                    : <span key={s.id}>{s.title.slice(0, 80)}</span>)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.watchNext && (
        <p className="text-sm"><span className="font-medium">This week, watch: </span>{content.watchNext}</p>
      )}

      <p className="text-xs text-tx-3">
        &ldquo;Moved together&rdquo; means these happened in the same window. It is not proof one caused the other.
      </p>
    </article>
  )
}
