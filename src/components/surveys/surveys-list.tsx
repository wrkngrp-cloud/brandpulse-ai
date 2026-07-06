'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast }     from 'sonner'
import Link          from 'next/link'
import { ItemActions, type ItemAction } from '@/components/ui/item-actions'
import { updateSurveyStatus, deleteSurvey } from '@/app/dashboard/surveys/actions'
import { Link2, Play, PauseCircle, RotateCcw, Trash2, ExternalLink } from 'lucide-react'
import { getTemplateLabel } from '@/lib/survey-templates'

interface Survey {
  id:           string
  name:         string
  type:         string | null
  status:       string
  created_at:   string
  responseCount: number
}

const STATUS_STYLES: Record<string, string> = {
  draft:  'bg-muted text-muted-foreground',
  live:   'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  closed: 'bg-muted text-muted-foreground',
}

interface Props {
  surveys: Survey[]
  appUrl:  string
}

function SurveyRow({ survey, appUrl }: { survey: Survey; appUrl: string }) {
  const router = useRouter()
  const [, start] = useTransition()

  function copyLink() {
    navigator.clipboard.writeText(`${appUrl}/survey/${survey.id}`)
    toast.success('Survey link copied!')
  }

  const actions: ItemAction[] = [
    {
      label:   'View responses',
      icon:    ExternalLink,
      onClick: () => router.push(`/dashboard/surveys/${survey.id}`),
    },
    {
      label:   'Copy survey link',
      icon:    Link2,
      onClick: copyLink,
    },
    // Status transitions
    ...(survey.status === 'draft' ? [{
      label:   'Publish',
      icon:    Play,
      onClick: () => start(async () => {
        await updateSurveyStatus(survey.id, 'live')
        toast.success('Survey is now live!')
      }),
    }] : []),
    ...(survey.status === 'live' ? [{
      label:   'Close survey',
      icon:    PauseCircle,
      onClick: () => start(async () => {
        await updateSurveyStatus(survey.id, 'closed')
        toast.success('Survey closed.')
      }),
    }] : []),
    ...(survey.status === 'closed' ? [{
      label:   'Reopen survey',
      icon:    RotateCcw,
      onClick: () => start(async () => {
        await updateSurveyStatus(survey.id, 'live')
        toast.success('Survey reopened.')
      }),
    }] : []),
    // Destructive
    {
      label:              'Delete survey',
      icon:               Trash2,
      variant:            'destructive' as const,
      separator:          true,
      requireConfirm:     true,
      confirmTitle:       'Delete survey',
      confirmDescription: `"${survey.name}" and all ${survey.responseCount} response${survey.responseCount !== 1 ? 's' : ''} will be permanently deleted.`,
      onClick: () => start(async () => {
        await deleteSurvey(survey.id)
        toast.success('Survey deleted.')
      }),
    },
  ]

  return (
    <div className="group relative flex items-center hover:bg-muted/50 transition-colors">
      <Link
        href={`/dashboard/surveys/${survey.id}`}
        className="flex flex-1 items-center justify-between px-5 py-4 min-w-0 pr-10"
      >
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-medium truncate">{survey.name}</p>
          <p className="text-xs text-muted-foreground">
            {survey.type ? `${getTemplateLabel(survey.type)} · ` : ''}
            {new Date(survey.created_at).toLocaleDateString('en-NG', {
              day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          <span className="text-xs text-muted-foreground">
            {survey.responseCount} {survey.responseCount === 1 ? 'response' : 'responses'}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[survey.status] ?? ''}`}>
            {survey.status}
          </span>
        </div>
      </Link>

      {/* Three-dot menu */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <ItemActions actions={actions} />
      </div>
    </div>
  )
}

export function SurveysList({ surveys, appUrl }: Props) {
  if (!surveys.length) return null
  return (
    <div className="border rounded-xl divide-y overflow-hidden">
      {surveys.map(s => <SurveyRow key={s.id} survey={s} appUrl={appUrl} />)}
    </div>
  )
}
