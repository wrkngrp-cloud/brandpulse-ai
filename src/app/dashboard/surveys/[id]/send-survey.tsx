'use client'

import { useState, useTransition } from 'react'
import { Mail, Send, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { sendSurveyEmails } from './actions'

interface Props {
  surveyId: string
  surveyName: string
  shareUrl: string
}

export function SendSurvey({ surveyId, surveyName: _surveyName, shareUrl: _shareUrl }: Props) {
  const [emails, setEmails]          = useState('')
  const [emailsSent, setEmailsSent]  = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleEmailSend() {
    const list = emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean)
    if (list.length === 0) { toast.error('Enter at least one email address.'); return }

    startTransition(async () => {
      const result = await sendSurveyEmails(surveyId, list)
      if (result.error) {
        toast.error(result.error)
      } else {
        setEmailsSent(true)
        setEmails('')
        toast.success(`Survey sent to ${result.sent} recipient${result.sent !== 1 ? 's' : ''}.`)
      }
    })
  }


  return (
    <div className="border rounded-xl p-5 bg-card space-y-5">
      <p className="text-sm font-semibold">Distribute survey</p>

      {/* Email */}
      <div className="space-y-2.5 border-t border-border/40 pt-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-foreground flex items-center justify-center shrink-0">
            <Mail className="h-3 w-3 text-background" />
          </div>
          <p className="text-sm font-medium">Email</p>
        </div>

        {emailsSent && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Emails sent. Add more recipients below to send again.
          </div>
        )}

        <Textarea
          value={emails}
          onChange={e => setEmails(e.target.value)}
          placeholder="Enter email addresses — one per line, or comma-separated"
          rows={3}
          className="text-sm resize-none"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Each recipient gets an email with the survey link.
        </p>
        <Button
          size="sm"
          onClick={handleEmailSend}
          disabled={isPending || !emails.trim()}
        >
          {isPending
            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</>
            : <><Send className="h-3.5 w-3.5 mr-1.5" />Send emails</>}
        </Button>
      </div>
    </div>
  )
}
