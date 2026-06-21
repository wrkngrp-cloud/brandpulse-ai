'use client'

import { useState } from 'react'
import { Copy, Check, Code2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function PixelCard() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const snippet = `;(function(w,d,s){
  w.__bp=w.__bp||{q:[],track:function(e,v,m){this.q.push({e,v,m,t:Date.now()})}};
  var el=d.createElement(s);el.async=1;
  el.src='https://cdn.brandpulse.ai/pixel.js';
  d.head.appendChild(el);
  w.__bp.track('page_view',1,{url:location.href,ref:document.referrer});
})(window,document,'script');`

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success('Copied')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Code2 className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-[13.5px] font-semibold">BrandPulse Pixel & SDK</p>
          <p className="text-[12px] text-muted-foreground">JS snippet for websites. React Native + Flutter SDK for mobile apps.</p>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline shrink-0"
        >
          {open ? 'Collapse' : 'Setup'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div className="border-t px-5 py-5 space-y-5 bg-muted/20">

          {/* Web snippet */}
          <div>
            <p className="text-[12px] font-semibold mb-2">1. Add this snippet to your website {"<head>"}</p>
            <div className="rounded-xl bg-zinc-950 text-zinc-100 p-4 text-[11.5px] font-mono leading-relaxed relative">
              <pre className="whitespace-pre-wrap break-all">{snippet}</pre>
              <button
                onClick={() => copy(snippet, 'snippet')}
                className="absolute top-3 right-3 flex items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 rounded px-2 py-1"
              >
                {copied === 'snippet' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied === 'snippet' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Track events */}
          <div>
            <p className="text-[12px] font-semibold mb-2">2. Track custom events (optional)</p>
            <div className="rounded-xl bg-zinc-950 text-zinc-100 p-4 text-[11.5px] font-mono leading-relaxed">
              <pre>{`// Track a purchase
window.__bp.track('purchase', 4500, { product: 'Jara Combo' });

// Track a form submission
window.__bp.track('lead_form', 1, { form: 'newsletter' });

// Track a button click
window.__bp.track('cta_click', 1, { label: 'Order Now' });`}</pre>
            </div>
          </div>

          {/* Mobile SDK */}
          <div className="rounded-xl border bg-background p-4 space-y-2">
            <p className="text-[12px] font-semibold">Mobile SDK</p>
            <p className="text-[12px] text-muted-foreground">React Native and Flutter SDKs are available. Install via npm or pub.dev:</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { label: 'React Native', cmd: 'npm install @brandpulse/rn-sdk' },
                { label: 'Flutter', cmd: 'flutter pub add brandpulse_sdk' },
              ].map(({ label, cmd }) => (
                <div key={label} className="rounded-lg bg-muted px-3 py-2 flex items-center gap-2">
                  <code className="text-[11.5px] font-mono text-foreground">{cmd}</code>
                  <button onClick={() => copy(cmd, label)} className="text-muted-foreground hover:text-foreground">
                    {copied === label ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11.5px] text-muted-foreground">
            Events appear in the BrandPulse Funnel and Campaign Attribution dashboards within 5 minutes of firing.
          </p>
        </div>
      )}
    </div>
  )
}
