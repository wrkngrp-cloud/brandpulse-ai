'use client'

import { useState, useTransition } from 'react'
import { Mail, MessageCircle, Send, CheckCircle2, Loader2, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { sendSurveyEmails } from './actions'

interface Props {
  surveyId: string
  surveyName: string
  shareUrl: string
}

export function SendSurvey({ surveyId, surveyName, shareUrl }: Props) {
  const [emails, setEmails]            = useState('')
  const [phones, setPhones]            = useState('')
  const [emailsSent, setEmailsSent]    = useState(false)
  const [phonesSent, setPhonesSent]    = useState(false)
  const [isPending, startTransition]   = useTransition()
  const [wpPending, startWpTransition] = useTransition()

  const whatsappText = encodeURIComponent(
    `Hi! We'd love your feedback on ${surveyName}. It takes less than 2 minutes.\n\n${shareUrl}`
  )
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`

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

  function handleWhatsAppSend() {
    const list = phones.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean)
    if (list.length === 0) { toast.error('Enter at least one phone number.'); return }

    startWpTransition(async () => {
      const res  = await fetch(`/api/surveys/${surveyId}/send-whatsapp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phones: list }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send WhatsApp messages.')
      } else {
        setPhonesSent(true)
        setPhones('')
        toast.success(`Sent to ${data.sent} number${data.sent !== 1 ? 's' : ''}${data.failed > 0 ? ` (${data.failed} failed)` : ''}.`)
      }
    })
  }

  return (
    <div className="border rounded-xl p-5 bg-card space-y-5">
      <p className="text-sm font-semibold">Distribute survey</p>

      {/* WhatsApp — share link */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
        <div className="h-8 w-8 rounded-full bg-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
          <MessageCircle className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">WhatsApp — Share link</p>
          <p className="text-xs text-muted-foreground mt-0.5">Open a pre-filled message to share directly.</p>
        </div>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="shrink-0">
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Share
          </Button>
        </a>
      </div>

      {/* WhatsApp — direct send via API */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
            <Phone className="h-3 w-3 text-white" />
          </div>
          <p className="text-sm font-medium">WhatsApp — Direct send</p>
        </div>

        {phonesSent && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Messages sent. Add more numbers to send again.
          </div>
        )}

        <Textarea
          value={phones}
          onChange={e => setPhones(e.target.value)}
          placeholder={`+2348012345678\n+2349098765432`}
          rows={3}
          className="text-sm resize-none font-mono"
          disabled={wpPending}
        />
        <p className="text-xs text-muted-foreground">
          Include country code. One per line or comma-separated. Requires WhatsApp Business API (Africa&apos;s Talking).
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleWhatsAppSend}
          disabled={wpPending || !phones.trim()}
        >
          {wpPending
            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</>
            : <><Send className="h-3.5 w-3.5 mr-1.5" />Send via WhatsApp</>}
        </Button>
      </div>

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
