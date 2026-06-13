'use client'

import Link             from 'next/link'
import { useRouter }    from 'next/navigation'
import { cn }           from '@/lib/utils'
import { ItemActions }  from '@/components/ui/item-actions'
import { Eye, Trash2, PauseCircle, PlayCircle } from 'lucide-react'
import { deleteCampaign, updateCampaignStatus } from '@/app/dashboard/campaigns/actions'

interface Channel {
  channel: string
  budget_allocation: number | null
}

interface Campaign {
  id: string
  name: string
  description: string | null
  objective: string | null
  start_date: string | null
  end_date: string | null
  total_budget: number | null
  currency: string
  status: string
  campaign_channels: Channel[]
}

interface CampaignsListProps {
  campaigns: Campaign[]
}

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness:     'Brand Awareness',
  consideration: 'Consideration',
  conversion:    'Conversion',
  retention:     'Retention',
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-muted text-muted-foreground',
  active:    'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300',
  paused:    'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtBudget(amount: number | null, currency: string) {
  if (!amount) return null
  return `${currency} ${Number(amount).toLocaleString('en-NG')}`
}

export function CampaignsList({ campaigns }: CampaignsListProps) {
  const router = useRouter()

  return (
    <div className="divide-y border rounded-xl overflow-hidden">
      {campaigns.map(c => {
        const channels = c.campaign_channels?.map(cc => cc.channel) ?? []
        const dateRange = c.start_date
          ? c.end_date
            ? `${fmtDate(c.start_date)} – ${fmtDate(c.end_date)}`
            : `From ${fmtDate(c.start_date)} · Always On`
          : c.end_date
            ? `Until ${fmtDate(c.end_date)}`
            : 'No dates set'

        return (
          <div
            key={c.id}
            className="flex items-center gap-4 px-4 py-3.5 bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/dashboard/campaigns/${c.id}`}
                  className="text-sm font-medium hover:underline truncate"
                >
                  {c.name}
                </Link>
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', STATUS_STYLES[c.status] ?? STATUS_STYLES.draft)}>
                  {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </span>
                {c.objective && (
                  <span className="text-xs text-muted-foreground">
                    {OBJECTIVE_LABELS[c.objective] ?? c.objective}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {dateRange}
                {channels.length > 0 && ` · ${channels.join(', ').toUpperCase()}`}
                {c.total_budget ? ` · ${fmtBudget(c.total_budget, c.currency)}` : ''}
              </p>
            </div>

            <ItemActions
              actions={[
                {
                  label:   'View campaign',
                  icon:    Eye,
                  onClick: () => router.push(`/dashboard/campaigns/${c.id}`),
                },
                ...(c.status === 'active' ? [{
                  label:   'Pause',
                  icon:    PauseCircle,
                  onClick: async () => {
                    await updateCampaignStatus(c.id, 'paused')
                    router.refresh()
                  },
                }] : []),
                ...(c.status === 'paused' ? [{
                  label:   'Resume',
                  icon:    PlayCircle,
                  onClick: async () => {
                    await updateCampaignStatus(c.id, 'active')
                    router.refresh()
                  },
                }] : []),
                {
                  label:              'Delete',
                  icon:               Trash2,
                  variant:            'destructive' as const,
                  separator:          true,
                  requireConfirm:     true,
                  confirmTitle:       'Delete campaign?',
                  confirmDescription: `"${c.name}" and its channel configuration will be deleted. OOH sites and events will not be deleted — they will become unlinked.`,
                  onClick:            async () => {
                    await deleteCampaign(c.id)
                    router.refresh()
                  },
                },
              ]}
            />
          </div>
        )
      })}
    </div>
  )
}
