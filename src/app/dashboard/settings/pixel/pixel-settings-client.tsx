'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Copy, Check, Zap, Code2, Activity, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface SdkEvent {
  id: string
  event_type: string
  value: number | null
  page_url: string | null
  occurred_at: string
}

interface Props {
  pixelId: string | null
  recentEvents: SdkEvent[]
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success(`${label} copied`)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border border-border bg-background hover:bg-accent transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// Snippet URLs must point at a host we control today; NEXT_PUBLIC_APP_URL flips
// them to the custom domain at cutover.
const SDK_BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://brandpulse-ai-tau.vercel.app'

function buildSnippet(pixelId: string): string {
  return `;(function(w,d,s,id){
  w.__bp=w.__bp||{q:[],track:function(e,v,m){this.q.push({e,v,m,t:Date.now()})}};
  var el=d.createElement(s);
  el.async=1;
  el.src='${SDK_BASE}/api/sdk/pixel.js';
  el.setAttribute('data-pixel-id',id);
  d.head.appendChild(el);
})(window,document,'script','${pixelId}');
// Track page view automatically
window.__bp.track('page_view',1,{url:location.href,ref:document.referrer});`
}

function buildLeadSnippet(pixelId: string): string {
  return `fetch('${SDK_BASE}/api/sdk/event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pixel_id: '${pixelId}',
    event_type: 'lead',
    metadata: { name: 'Jane Doe', email: 'jane@company.com' },
  }),
});`
}

function buildSignupSnippetReactNative(pixelId: string): string {
  return `fetch('${SDK_BASE}/api/sdk/event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pixel_id: '${pixelId}',
    event_type: 'signup',
    metadata: { email: user.email, phone: user.phone },
  }),
});`
}

function buildSignupSnippetFlutter(pixelId: string): string {
  return `await http.post(
  Uri.parse('${SDK_BASE}/api/sdk/event'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'pixel_id': '${pixelId}',
    'event_type': 'signup',
    'metadata': {'email': user.email, 'phone': user.phone},
  }),
);`
}

export function PixelSettingsClient({ pixelId: initialPixelId, recentEvents: initialEvents }: Props) {
  const [pixelId, setPixelId] = useState<string | null>(initialPixelId)
  const [events, setEvents] = useState<SdkEvent[]>(initialEvents)
  const [isPending, startTransition] = useTransition()

  function handleSetup() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/sdk/pixel', { method: 'POST' })
        if (!res.ok) throw new Error('Setup failed')
        const data = await res.json() as { pixel_id: string }
        setPixelId(data.pixel_id)
        toast.success('Pixel created')
      } catch {
        toast.error('Could not create pixel. Try again.')
      }
    })
  }

  function handleTestEvent() {
    if (!pixelId) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/sdk/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pixel_id: pixelId,
            event_type: 'test_event',
            page_url: window.location.href,
            metadata: { source: 'manual_test' },
          }),
        })
        if (!res.ok) throw new Error('Event failed')
        toast.success('Test event sent')
        // Refresh event list
        const refreshRes = await fetch('/api/sdk/pixel')
        if (refreshRes.ok) {
          // Optimistically add the event at the top
          setEvents(prev => [{
            id: crypto.randomUUID(),
            event_type: 'test_event',
            value: null,
            page_url: window.location.href,
            occurred_at: new Date().toISOString(),
          }, ...prev].slice(0, 10))
        }
      } catch {
        toast.error('Test event failed. Check your pixel ID.')
      }
    })
  }

  if (!pixelId) {
    return (
      <div className="space-y-6">
        <div className="border rounded-xl p-8 bg-card text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Code2 className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">No pixel set up yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Generate your tracking pixel to start capturing page views and custom events from your website.
            </p>
          </div>
          <Button onClick={handleSetup} disabled={isPending}>
            {isPending ? 'Setting up...' : 'Generate pixel'}
          </Button>
        </div>
      </div>
    )
  }

  const snippet = buildSnippet(pixelId)
  const leadSnippet = buildLeadSnippet(pixelId)
  const signupSnippetRN      = buildSignupSnippetReactNative(pixelId)
  const signupSnippetFlutter = buildSignupSnippetFlutter(pixelId)

  return (
    <div className="space-y-6">
      {/* Pixel ID */}
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Your Pixel ID</p>
          <Badge variant="secondary" className="text-xs">Active</Badge>
        </div>
        <div className="flex items-center gap-3">
          <code className="flex-1 font-mono text-sm bg-muted px-3 py-2 rounded-lg border">
            {pixelId}
          </code>
          <CopyButton text={pixelId} label="Pixel ID" />
        </div>
      </div>

      {/* Snippet */}
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Tracking snippet</p>
          </div>
          <CopyButton text={snippet} label="Snippet" />
        </div>
        <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all border">
          {snippet}
        </pre>
      </div>

      {/* Lead capture snippet */}
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Lead capture snippet</p>
          </div>
          <CopyButton text={leadSnippet} label="Lead snippet" />
        </div>
        <p className="text-sm text-muted-foreground">
          Fire a <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">lead</code> event
          from your contact form&apos;s submit handler. These events power the MQL and
          Cost Per Lead numbers on your Board Pack and Business Case.
        </p>
        <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all border">
          {leadSnippet}
        </pre>
      </div>

      {/* Mobile app signup snippet */}
      <div className="border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Mobile app signup snippet</p>
        </div>
        <p className="text-sm text-muted-foreground">
          If your product is a mobile app, growth usually starts with a signup, not a website form.
          Fire a <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">signup</code> event
          from your app&apos;s registration-complete handler and BrandGauge will count real
          new customers from it instead of estimating them from payments alone. This is what
          powers CAC and new customers on Board Pack and Business Case for app-based brands.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">React Native</p>
            <CopyButton text={signupSnippetRN} label="React Native snippet" />
          </div>
          <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all border">
            {signupSnippetRN}
          </pre>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Flutter</p>
            <CopyButton text={signupSnippetFlutter} label="Flutter snippet" />
          </div>
          <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all border">
            {signupSnippetFlutter}
          </pre>
        </div>
      </div>

      {/* How to use */}
      <div className="border rounded-xl p-5 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">How to use</p>
        </div>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Copy the snippet above using the Copy button.</li>
          <li>
            Paste it before the closing{' '}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">&lt;/head&gt;</code>{' '}
            tag on every page of your website.
          </li>
          <li>
            Verify it works by clicking{' '}
            <span className="font-medium text-foreground">Send test event</span>{' '}
            below — it should appear in the event table within seconds.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground border-t pt-3">
          Track custom events anywhere on your site:{' '}
          <code className="font-mono bg-muted px-1 py-0.5 rounded">
            {`window.__bp.track('purchase', 5000, { product: 'Pro Plan' })`}
          </code>
        </p>
      </div>

      {/* Test event + recent events */}
      <div className="border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Recent events</p>
            {events.length > 0 && (
              <span className="text-xs text-muted-foreground">(last 10)</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestEvent}
            disabled={isPending}
          >
            {isPending ? 'Sending...' : 'Send test event'}
          </Button>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No events yet. Send a test event or add the snippet to your site.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs">Event</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs">Value</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs">Page</th>
                  <th className="text-left py-2 font-medium text-muted-foreground text-xs">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="py-2 pr-4">
                      <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {ev.event_type}
                      </code>
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {ev.value != null ? ev.value.toLocaleString() : '—'}
                    </td>
                    <td className="py-2 pr-4 max-w-[180px]">
                      <span
                        className="text-xs text-muted-foreground truncate block"
                        title={ev.page_url ?? ''}
                      >
                        {ev.page_url
                          ? new URL(ev.page_url).pathname.slice(0, 30) || '/'
                          : '—'}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(ev.occurred_at).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZone: 'Africa/Lagos',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
