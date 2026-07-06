'use client'

import { Star, GitFork, CircleDot, Download, MessageCircleQuestion, GitBranch, Code2, Package, TrendingUp, TrendingDown } from 'lucide-react'

interface Snapshot {
  platform:         string
  stars:            number | null
  forks:            number | null
  open_issues:      number | null
  downloads_weekly: number | null
  question_count:   number | null
  period_end:       string | null
}

interface Props {
  github:        Snapshot | null
  githubPrev:    Snapshot | null
  npm:           Snapshot | null
  npmPrev:       Snapshot | null
  stackoverflow: Snapshot | null
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-NG')
}

function Delta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return null
  const diff = current - previous
  if (diff === 0) return null
  const up = diff > 0
  return (
    <span className={`ml-1.5 inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{diff.toLocaleString('en-NG')}
    </span>
  )
}

function Metric({
  icon, label, value, delta,
}: {
  icon: React.ReactNode
  label: string
  value: string
  delta?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums flex items-baseline">
        {value}
        {delta}
      </p>
    </div>
  )
}

export function DeveloperHealthPanel({ github, githubPrev, npm, npmPrev, stackoverflow }: Props) {
  const lastSynced = github?.period_end ?? npm?.period_end ?? stackoverflow?.period_end ?? null
  const lastSyncedLabel = lastSynced
    ? new Date(lastSynced).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })
    : null

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">Developer Health</h2>
            <p className="text-xs text-muted-foreground">GitHub, npm, and Stack Overflow ecosystem signals</p>
          </div>
        </div>
      </div>

      {github && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" /> GitHub
          </p>
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <Metric icon={<Star className="h-3 w-3" />} label="Stars" value={fmt(github.stars)}
              delta={<Delta current={github.stars} previous={githubPrev?.stars ?? null} />} />
            <Metric icon={<GitFork className="h-3 w-3" />} label="Forks" value={fmt(github.forks)}
              delta={<Delta current={github.forks} previous={githubPrev?.forks ?? null} />} />
            <Metric icon={<CircleDot className="h-3 w-3" />} label="Open issues" value={fmt(github.open_issues)}
              delta={<Delta current={github.open_issues} previous={githubPrev?.open_issues ?? null} />} />
          </div>
        </div>
      )}

      {npm && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> npm
          </p>
          <Metric icon={<Download className="h-3 w-3" />} label="Weekly downloads" value={fmt(npm.downloads_weekly)}
            delta={<Delta current={npm.downloads_weekly} previous={npmPrev?.downloads_weekly ?? null} />} />
        </div>
      )}

      {stackoverflow && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MessageCircleQuestion className="h-3.5 w-3.5" /> Stack Overflow
          </p>
          <Metric icon={<MessageCircleQuestion className="h-3 w-3" />} label="Tagged questions" value={fmt(stackoverflow.question_count)} />
        </div>
      )}

      {lastSyncedLabel && (
        <p className="text-xs text-muted-foreground border-t pt-3">Last synced {lastSyncedLabel}</p>
      )}
    </div>
  )
}
