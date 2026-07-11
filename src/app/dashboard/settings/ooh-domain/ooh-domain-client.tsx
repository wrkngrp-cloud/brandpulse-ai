'use client'

import { useActionState, useState } from 'react'
import { toast }                     from 'sonner'
import { useEffect }                 from 'react'
import { Button }                    from '@/components/ui/button'
import { Input }                     from '@/components/ui/input'
import { Label }                     from '@/components/ui/label'
import { saveOohDomain, removeOohDomain } from './actions'
import { Copy, CheckCircle2, AlertCircle, Globe, Link2, Wrench } from 'lucide-react'
import { cn }                        from '@/lib/utils'

type State = { error?: string; success?: string; cname?: string } | null

interface OohDomainClientProps {
  brandName:     string
  currentDomain: string | null
  appUrl:        string
  appHost:       string
}

type Tier = 'brandgauge' | 'subdomain' | 'main-domain'

export function OohDomainClient({ brandName, currentDomain, appUrl, appHost }: OohDomainClientProps) {
  const [state, formAction, pending] = useActionState(saveOohDomain, null)
  const [tier,        setTier]       = useState<Tier>(currentDomain ? 'subdomain' : 'brandgauge')
  const [inputDomain, setInputDomain] = useState(currentDomain ?? '')
  const [removing,    setRemoving]   = useState(false)

  useEffect(() => {
    if (state?.error)   toast.error(state.error)
    if (state?.success) toast.success(state.success)
  }, [state])

  async function handleRemove() {
    setRemoving(true)
    try {
      const result = await removeOohDomain()
      if (result?.error) toast.error(result.error)
      else toast.success('Custom domain removed.')
    } finally {
      setRemoving(false)
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'))
  }

  const exampleSlug   = 'morelife'
  const brandSlug     = brandName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const brandgaugeUrl = `${appUrl}/go/${brandSlug}-${exampleSlug}`
  const subdomainUrl  = inputDomain ? `https://${inputDomain}/${exampleSlug}` : `https://go.${brandSlug}.com/${exampleSlug}`
  const mainDomainUrl = `https://${brandSlug}.com/${exampleSlug}`

  return (
    <div className="space-y-5">

      {/* Tier picker */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TierCard
          active={tier === 'brandgauge'}
          onClick={() => setTier('brandgauge')}
          icon={<Link2 className="h-4 w-4" />}
          title="BrandGauge does it"
          badge="Easiest"
          badgeColor="green"
          description="Your links live on our domain. Zero setup. Ideal for getting started fast."
          example={brandgaugeUrl}
        />
        <TierCard
          active={tier === 'subdomain'}
          onClick={() => setTier('subdomain')}
          icon={<Globe className="h-4 w-4" />}
          title="Your subdomain"
          badge="Recommended"
          badgeColor="blue"
          description="go.yourbrand.com/slug — one DNS record and we handle the rest."
          example={subdomainUrl}
        />
        <TierCard
          active={tier === 'main-domain'}
          onClick={() => setTier('main-domain')}
          icon={<Wrench className="h-4 w-4" />}
          title="Your main domain"
          badge="Advanced"
          badgeColor="amber"
          description="yourbrand.com/slug — requires a redirect rule on your CDN or server."
          example={mainDomainUrl}
        />
      </div>

      {/* Tier content */}
      {tier === 'brandgauge' && (
        <div className="border rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">You&apos;re already set up</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                All your OOH vanity links use our platform domain. No action needed.
              </p>
            </div>
          </div>
          <div className="bg-muted/50 border rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
            <span className="text-xs font-mono break-all">{brandgaugeUrl}</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 shrink-0 text-xs" onClick={() => copy(brandgaugeUrl)}>
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
          </div>
          {currentDomain && (
            <p className="text-xs text-muted-foreground">
              Note: you have a custom domain saved ({currentDomain}). Links will still use that until you remove it.
            </p>
          )}
        </div>
      )}

      {tier === 'subdomain' && (
        <div className="border rounded-xl p-5 space-y-5">
          <div>
            <p className="text-sm font-medium">Set up your subdomain</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              We&apos;ll add your subdomain to our routing automatically. You just add one DNS record.
            </p>
          </div>

          <form action={formAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="domain">Your OOH subdomain</Label>
              <Input
                id="domain" name="domain"
                placeholder="go.yourbrand.com"
                value={inputDomain}
                onChange={e => setInputDomain(e.target.value.toLowerCase())}
                required
              />
              <p className="text-xs text-muted-foreground">
                Convention: use <code className="bg-muted px-1 rounded">go.</code> or <code className="bg-muted px-1 rounded">track.</code> as the subdomain prefix.
              </p>
            </div>
            <Button type="submit" disabled={pending} size="sm">
              {pending ? 'Saving…' : currentDomain ? 'Update domain' : 'Save and add to routing'}
            </Button>
          </form>

          {/* DNS instructions — show after save or if already configured */}
          {(currentDomain || state?.cname) && (
            <DnsInstructions
              domain={state?.cname ?? currentDomain ?? ''}
              appHost={appHost}
              onCopy={copy}
            />
          )}

          {currentDomain && (
            <div className="pt-2 border-t">
              <Button
                type="button" variant="destructive" size="sm"
                onClick={handleRemove} disabled={removing}
              >
                {removing ? 'Removing…' : 'Remove custom domain'}
              </Button>
            </div>
          )}
        </div>
      )}

      {tier === 'main-domain' && (
        <div className="border rounded-xl p-5 space-y-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Your main domain — two steps</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                We can&apos;t intercept traffic on your main domain directly. The approach: set up your subdomain first (Step 1), then add a redirect rule on your CDN/server for the specific path (Step 2).
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Step
              number={1}
              title="Set up a tracking subdomain"
              description={`Follow the "Your subdomain" option above to configure go.${brandSlug}.com. This is the actual tracking endpoint.`}
            />
            <Step
              number={2}
              title="Add a redirect rule on your CDN"
              description={`Tell your server or Cloudflare to redirect the billboard path to the tracking subdomain. We generate the snippet for you.`}
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cloudflare Redirect Rule</p>
            <CodeBlock
              code={`# In Cloudflare: Rules → Redirect Rules → Create Rule\n# Match: URI Path starts with /morelife (replace with your slug)\n# Action: Dynamic Redirect\n# Expression: concat("https://go.${brandSlug}.com", http.request.uri.path)`}
              onCopy={copy}
            />

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">Nginx</p>
            <CodeBlock
              code={`# In your nginx.conf server block:\nlocation /morelife {\n  return 301 https://go.${brandSlug}.com$request_uri;\n}`}
              onCopy={copy}
            />

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">Next.js redirects (next.config.js)</p>
            <CodeBlock
              code={`// next.config.js\nmodule.exports = {\n  async redirects() {\n    return [\n      {\n        source: '/morelife',\n        destination: 'https://go.${brandSlug}.com/morelife',\n        permanent: true,\n      },\n    ]\n  },\n}`}
              onCopy={copy}
            />
          </div>

          <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>How attribution still works:</strong></p>
            <p>Visitor hits <code>yourbrand.com/morelife</code> → your CDN 301s to <code>go.yourbrand.com/morelife</code> → our server logs the visit → 301s to your landing page. Two hops, full attribution. The browser&apos;s back button works correctly.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function TierCard({
  active, onClick, icon, title, badge, badgeColor, description, example
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode
  title: string; badge: string; badgeColor: 'green' | 'blue' | 'amber'
  description: string; example: string
}) {
  const badgeStyles = {
    green: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300',
    blue:  'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left border rounded-xl p-4 space-y-2 transition-all',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:border-muted-foreground/30 hover:bg-muted/30'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon} {title}
        </div>
        <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', badgeStyles[badgeColor])}>
          {badge}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      <p className="text-xs font-mono text-muted-foreground/70 truncate">{example}</p>
    </button>
  )
}

function DnsInstructions({ domain, appHost, onCopy }: { domain: string; appHost: string; onCopy: (t: string) => void }) {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <p className="text-sm font-medium flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        Domain added to routing. Now add this DNS record:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-1.5 pr-4 font-medium">Type</th>
              <th className="text-left py-1.5 pr-4 font-medium">Name</th>
              <th className="text-left py-1.5 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1.5 pr-4 font-mono">CNAME</td>
              <td className="py-1.5 pr-4 font-mono">{domain.split('.')[0]}</td>
              <td className="py-1.5 font-mono flex items-center gap-1.5">
                cname.vercel-dns.com
                <button onClick={() => onCopy('cname.vercel-dns.com')} className="hover:text-foreground transition-colors">
                  <Copy className="h-3 w-3" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        DNS propagation typically takes 5–30 minutes. Once live, test by visiting <code className="bg-muted px-1 rounded">https://{domain}/test</code> — you should see a BrandGauge 302 redirect.
      </p>
    </div>
  )
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {number}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  )
}

function CodeBlock({ code, onCopy }: { code: string; onCopy: (t: string) => void }) {
  return (
    <div className="relative rounded-lg bg-muted border text-xs font-mono">
      <button
        type="button"
        onClick={() => onCopy(code)}
        className="absolute top-2 right-2 p-1 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <pre className="p-3 pr-8 overflow-x-auto whitespace-pre-wrap leading-relaxed">{code}</pre>
    </div>
  )
}
