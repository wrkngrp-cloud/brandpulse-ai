'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { MessageCircle, Users, Send, BarChart2, CheckCircle2, AlertCircle,
         Plus, Loader2, ChevronRight, Clock, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Campaign } from './page'

interface Props {
  brandName: string
  configured: boolean
  stats: {
    contactCount: number
    optedInCount: number
    campaignCount: number
    avgDeliveryRate: number
    avgReadRate: number
  }
  campaigns: Campaign[]
}

interface Template {
  name: string
  language: string
  category: string
}

const OBJECTIVES = [
  { value: 'broadcast',    label: 'Broadcast announcement' },
  { value: 'survey',       label: 'Survey dispatch' },
  { value: 'nps',          label: 'NPS follow-up' },
  { value: 'reengagement', label: 'Re-engagement' },
  { value: 'promotion',    label: 'Promotion / offer' },
]

function pct(n: number, of: number) {
  if (!of) return '—'
  return Math.round((n / of) * 100) + '%'
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    sent:      { label: 'Sent',      className: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
    sending:   { label: 'Sending…',  className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
    scheduled: { label: 'Scheduled', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
    failed:    { label: 'Failed',    className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  }
  const { label, className } = map[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', className)}>{label}</span>
}

export function WhatsAppClient({ brandName, configured, stats, campaigns }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({
    name: '', objective: 'broadcast', template_name: '', template_language: 'en', consented: false,
  })
  const fetchedTemplates = useRef(false)

  useEffect(() => {
    if (sheetOpen && !fetchedTemplates.current && configured) {
      fetchedTemplates.current = true
      setLoadingTemplates(true)
      fetch('/api/whatsapp/templates')
        .then(r => r.json())
        .then(d => setTemplates(d.templates ?? []))
        .catch(() => toast.error('Could not load templates'))
        .finally(() => setLoadingTemplates(false))
    }
  }, [sheetOpen, configured])

  async function handleSend() {
    if (!form.name.trim())           return toast.error('Give this campaign a name')
    if (!form.template_name)         return toast.error('Choose a message template')
    if (!form.consented)             return toast.error('Please confirm contacts have opted in')

    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:              form.name,
          objective:         form.objective,
          template_name:     form.template_name,
          template_language: form.template_language,
        }),
      })
      const data = await res.json() as { campaignId?: string; listSize?: number; error?: string }
      if (!res.ok || data.error) { toast.error(data.error ?? 'Send failed'); return }
      toast.success(`Campaign queued — sending to ${data.listSize?.toLocaleString()} contacts`)
      setSheetOpen(false)
      setForm({ name: '', objective: 'broadcast', template_name: '', template_language: 'en', consented: false })
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      toast.error('Network error')
    } finally {
      setSending(false)
    }
  }

  if (!configured) {
    return (
      <div className="max-w-2xl space-y-8 pb-12">
        <div>
          <p className="eyebrow mb-1">Messaging</p>
          <h1 className="h-display text-[26px] leading-none">WhatsApp</h1>
        </div>
        <div className="border rounded-xl p-8 bg-card text-center space-y-4">
          <div className="h-12 w-12 rounded-xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center mx-auto">
            <MessageCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="font-semibold">WhatsApp not configured</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Add your WhatsApp Business API credentials to start sending. All sends come from your BrandPulse-verified number.
            </p>
          </div>
          <div className="text-left bg-muted/40 rounded-lg p-4 text-xs font-mono space-y-1 max-w-sm mx-auto">
            <p>WHATSAPP_PHONE_NUMBER_ID=</p>
            <p>WHATSAPP_BUSINESS_ACCOUNT_ID=</p>
            <p>WHATSAPP_ACCESS_TOKEN=</p>
            <p>WHATSAPP_APP_SECRET=</p>
            <p>WHATSAPP_VERIFY_TOKEN=</p>
          </div>
          <p className="text-xs text-muted-foreground">Get these from your Meta Business Manager → WhatsApp → API Setup</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow mb-1">Messaging</p>
          <h1 className="h-display text-[26px] leading-none">WhatsApp</h1>
          <p className="mt-2 text-[13px] text-muted-foreground/70 max-w-xl">
            Send broadcast campaigns, surveys, and NPS follow-ups to your opted-in contacts.
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)} className="inline-flex items-center gap-2 shrink-0">
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Opted-in contacts', value: stats.optedInCount.toLocaleString(), icon: Users },
          { label: 'Campaigns sent',    value: stats.campaignCount.toLocaleString(), icon: Send },
          { label: 'Avg delivery rate', value: stats.avgDeliveryRate ? stats.avgDeliveryRate + '%' : '—', icon: CheckCircle2 },
          { label: 'Avg read rate',     value: stats.avgReadRate     ? stats.avgReadRate     + '%' : '—', icon: BarChart2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="border rounded-xl p-4 bg-card space-y-1">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <p className="text-xl font-bold tracking-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Contacts link */}
      <Link
        href="/dashboard/whatsapp/contacts"
        className="flex items-center justify-between border rounded-xl p-4 bg-card hover:bg-muted/30 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Contact list</p>
            <p className="text-xs text-muted-foreground">
              {stats.contactCount} total · {stats.optedInCount} opted in
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </Link>

      {/* Campaign history */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Campaign history</h2>

        {campaigns.length === 0 ? (
          <div className="border rounded-xl p-8 bg-card text-center text-sm text-muted-foreground">
            No campaigns yet. Click "New campaign" to send your first WhatsApp broadcast.
          </div>
        ) : (
          <div className="border rounded-xl bg-card overflow-hidden divide-y">
            {campaigns.map(c => (
              <div key={c.id} className="p-4 flex items-start gap-4">
                <div className="h-8 w-8 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center shrink-0 mt-0.5">
                  {c.status === 'sending'
                    ? <Loader2 className="h-3.5 w-3.5 text-green-600 animate-spin" />
                    : c.status === 'sent'
                    ? <CheckCheck className="h-3.5 w-3.5 text-green-600" />
                    : c.status === 'failed'
                    ? <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    : <Clock className="h-3.5 w-3.5 text-amber-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Template: <span className="font-mono">{c.template_name}</span>
                  </p>
                  {c.status === 'sent' && c.sent > 0 && (
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <span>{c.sent.toLocaleString()} sent</span>
                      <span>·</span>
                      <span className="text-green-700 dark:text-green-400">
                        {pct(c.delivered, c.sent)} delivered
                      </span>
                      <span>·</span>
                      <span className="text-blue-700 dark:text-blue-400">
                        {pct(c.read_count, c.sent)} read
                      </span>
                      {c.failed > 0 && (
                        <><span>·</span><span className="text-red-600">{c.failed} failed</span></>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(c.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* New Campaign Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New WhatsApp campaign</SheetTitle>
            <SheetDescription>
              Sends to all opted-in contacts for {brandName || 'your brand'}.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="wa-name">Campaign name</Label>
              <Input
                id="wa-name"
                placeholder="e.g. Ramadan offer broadcast"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Objective</Label>
              <Select value={form.objective} onValueChange={(v) => { if (v) setForm(f => ({ ...f, objective: v })) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OBJECTIVES.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Message template</Label>
              {loadingTemplates ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading approved templates…
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
                  No approved templates found. Create and get templates approved in your Meta Business Manager first.
                </div>
              ) : (
                <Select value={form.template_name} onValueChange={(v) => {
                  if (!v) return
                  const t = templates.find(t => t.name === v)
                  setForm(f => ({ ...f, template_name: v, template_language: t?.language ?? 'en' }))
                }}>
                  <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.name} value={t.name}>
                        <span className="font-mono text-xs">{t.name}</span>
                        <span className="ml-2 text-muted-foreground text-xs">{t.category}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Before you send</p>
              <p>· Only opted-in contacts will receive this message.</p>
              <p>· Replies of "STOP" automatically remove the contact.</p>
              <p>· Sends are limited to 1,000 conversations per day.</p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary shrink-0"
                checked={form.consented}
                onChange={e => setForm(f => ({ ...f, consented: e.target.checked }))}
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I confirm all contacts in this list have explicitly opted in to receive WhatsApp messages from this brand, in compliance with Nigeria&apos;s NDPR.
              </span>
            </label>

            <Button
              className="w-full"
              onClick={handleSend}
              disabled={sending || !form.name || !form.template_name || !form.consented}
            >
              {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Queuing…</> : 'Send campaign'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
