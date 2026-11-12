import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Inbox / Sent / Drafts, as three routes rather than one page with client
 * state — each is its own simple server-rendered list, and a mailbox this
 * size does not need the shared queue's live-updating machinery.
 */
export function MailTabs({ base, active, draftCount }: {
  base: string
  active: 'inbox' | 'sent' | 'drafts'
  draftCount: number
}) {
  const tabs: { key: typeof active; label: string; href: string }[] = [
    { key: 'inbox',  label: 'Inbox',  href: base },
    { key: 'sent',   label: 'Sent',   href: `${base}/sent` },
    { key: 'drafts', label: `Drafts${draftCount ? ` (${draftCount})` : ''}`, href: `${base}/drafts` },
  ]

  return (
    <nav className="flex gap-1 border-b border-line">
      {tabs.map(tab => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            'bg-press rounded-t-md px-3 py-2 text-sm',
            tab.key === active
              ? 'border-b-2 border-flare font-medium text-tx-1'
              : 'text-tx-3',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
