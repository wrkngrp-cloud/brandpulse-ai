'use client'

import { useState, useTransition } from 'react'
import { Flag, CheckCircle, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const PLATFORM_LABEL: Record<string, string> = {
  twitter:   'X',
  instagram: 'IG',
}

const LABEL_COLOR: Record<string, string> = {
  positive: 'text-green-600',
  negative: 'text-red-500',
  mixed:    'text-amber-500',
  neutral:  'text-muted-foreground',
}

type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'mixed'

interface Mention {
  id: string
  content: string | null
  author_handle: string | null
  platform: string
  sentiment_label: string | null
  emotion_tags: string[] | null
  reach: number | null
  created_at: string
  disputed?: boolean
}

async function submitDispute(
  mentionId: string,
  correctedLabel: SentimentLabel,
  reason?: string
) {
  const res = await fetch('/api/sentiment/dispute', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ mentionId, correctedLabel, reason }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}))
    throw new Error(error ?? 'Dispute failed')
  }
  return res.json()
}

function DisputeMenu({
  mention,
  onDisputed,
}: {
  mention: Mention
  onDisputed: (id: string, newLabel: SentimentLabel) => void
}) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  if (done || mention.disputed) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
        <CheckCircle className="h-3 w-3" /> Corrected
      </span>
    )
  }

  const labels: SentimentLabel[] = ['positive', 'neutral', 'negative', 'mixed']
  const current = mention.sentiment_label as SentimentLabel | null

  function handleSelect(label: SentimentLabel) {
    startTransition(async () => {
      try {
        await submitDispute(mention.id, label)
        onDisputed(mention.id, label)
        setDone(true)
        toast.success(`Corrected to "${label}". Sentiment data updated.`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Dispute failed')
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        <Flag className="h-3 w-3" />
        {pending ? 'Saving…' : 'Dispute'}
        <ChevronDown className="h-2.5 w-2.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <p className="px-2 py-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          Correct label to
        </p>
        <DropdownMenuSeparator />
        {labels
          .filter(l => l !== current)
          .map(label => (
            <DropdownMenuItem
              key={label}
              onClick={() => handleSelect(label)}
              className={`text-sm capitalize ${LABEL_COLOR[label]}`}
            >
              {label}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MentionsList({ initialMentions }: { initialMentions: Mention[] }) {
  const [mentions, setMentions] = useState<Mention[]>(initialMentions)

  function handleDisputed(id: string, newLabel: SentimentLabel) {
    setMentions(prev =>
      prev.map(m => m.id === id ? { ...m, sentiment_label: newLabel, disputed: true } : m)
    )
  }

  if (!mentions.length) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Recent mentions</p>
        <p className="text-[11px] text-muted-foreground/60">
          Dispute wrong labels — corrections improve future analysis
        </p>
      </div>
      <div className="border rounded-xl divide-y overflow-hidden">
        {mentions.slice(0, 20).map(m => (
          <div key={m.id} className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {PLATFORM_LABEL[m.platform] ?? m.platform}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {m.author_handle ? `@${m.author_handle}` : 'unknown'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {m.sentiment_label && !m.disputed && (
                  <span className={`text-xs font-medium capitalize ${LABEL_COLOR[m.sentiment_label] ?? 'text-muted-foreground'}`}>
                    {m.sentiment_label}
                  </span>
                )}
                {m.disputed && m.sentiment_label && (
                  <span className={`text-xs font-medium capitalize line-through opacity-50 ${LABEL_COLOR[m.sentiment_label] ?? 'text-muted-foreground'}`}>
                    {m.sentiment_label}
                  </span>
                )}
                {m.disputed && (
                  <span className="text-xs font-semibold capitalize text-amber-600 dark:text-amber-400">
                    disputed
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })}
                </span>
                <DisputeMenu mention={m} onDisputed={handleDisputed} />
              </div>
            </div>
            <p className="text-sm leading-snug line-clamp-2">{m.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
