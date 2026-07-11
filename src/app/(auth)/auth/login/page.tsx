'use client'

import { Suspense, useActionState, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { login } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { cn } from '@/lib/utils'
import { Loader2, ArrowRight, BarChart2, Globe2, Users2, Zap } from 'lucide-react'

// ── Demo accounts ──────────────────────────────────────────────────────────────

const DEMOS = [
  {
    slug:     'jara',
    brand:    'Jara Foods',
    industry: 'FMCG',
    icon:     '🛒',
    tagline:  'Nigerian packaged goods brand with 12-month brand health story arc',
    email:    'demo@jarafoods.brandgauge.app',
    password: 'Demo@Jara2026!',
  },
  {
    slug:     'fintech',
    brand:    'PocketPay',
    industry: 'Fintech',
    icon:     '💳',
    tagline:  'Mobile payments app — PR crisis, recovery, Series A growth story',
    email:    'demo@pocketpay.brandgauge.app',
    password: 'Demo@PocketPay2026!',
  },
  {
    slug:     'agency',
    brand:    'Pinnacle Media',
    industry: 'Agency',
    icon:     '🏆',
    tagline:  'Full-service Lagos marketing agency managing multiple client brands',
    email:    'demo@pinnaclemedia.brandgauge.app',
    password: 'Demo@Pinnacle2026!',
  },
  {
    slug:     'saas',
    brand:    'Bridger CRM',
    industry: 'B2B SaaS',
    icon:     '⚙',
    tagline:  'Nigerian CRM tool — MRR, churn, NRR and enterprise launch story',
    email:    'demo@bridgercrm.brandgauge.app',
    password: 'Demo@Bridger2026!',
  },
]

// ── Feature highlights (left panel) ───────────────────────────────────────────

const FEATURES = [
  { icon: BarChart2, text: 'Brand Health Index across 7 components' },
  { icon: Globe2,    text: 'Sentiment, SOV and competitive intelligence' },
  { icon: Users2,    text: 'Influencer ROI, events and ambassador tracking' },
  { icon: Zap,       text: 'AI-powered insights in plain English' },
]

// ── Demo tile component ────────────────────────────────────────────────────────

function DemoTile({
  demo,
  onSelect,
  active,
}: {
  demo: typeof DEMOS[0]
  onSelect: (d: typeof DEMOS[0]) => void
  active: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(demo)}
      className={cn(
        'w-full text-left rounded-xl border p-3 transition-all hover:border-foreground/40 hover:bg-muted/30',
        active && 'border-foreground/60 bg-muted/40 ring-1 ring-foreground/10',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-xl leading-none mt-0.5">{demo.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-semibold">{demo.brand}</span>
            <span className="text-[11px] text-muted-foreground border rounded-full px-1.5 py-0.5 leading-none">{demo.industry}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{demo.tagline}</p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  )
}

// ── Login form ─────────────────────────────────────────────────────────────────

function LoginContent() {
  const [state, action, pending] = useActionState(login, null)
  const searchParams = useSearchParams()
  const linkExpired  = searchParams.get('error') === 'link_expired'

  const emailRef    = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const formRef     = useRef<HTMLFormElement>(null)

  const [selectedDemo, setSelectedDemo] = useState<typeof DEMOS[0] | null>(null)
  const [isLoggingInDemo, startDemo]    = useTransition()

  function handleDemoSelect(demo: typeof DEMOS[0]) {
    setSelectedDemo(demo)
    if (emailRef.current)    emailRef.current.value    = demo.email
    if (passwordRef.current) passwordRef.current.value = demo.password
    // Scroll to form on mobile
    emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left panel: branding ───────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-foreground text-background p-10">
        <div>
          <div className="flex items-center gap-2.5 mb-12">
            <div className="h-8 w-8 rounded-lg bg-background/10 flex items-center justify-center">
              <BarChart2 className="h-4 w-4 text-background" />
            </div>
            <span className="font-bold text-[15px] tracking-tight">BrandGauge</span>
          </div>

          <h2 className="text-[28px] font-bold leading-tight mb-4">
            Intelligence for Nigerian marketing teams
          </h2>
          <p className="text-[14px] text-background/60 leading-relaxed mb-8">
            Track brand health, measure campaigns, monitor competitors and generate board-ready reports. Built for West Africa.
          </p>

          <div className="space-y-3.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-background/10 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-background/80" />
                </div>
                <span className="text-[13px] text-background/80">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-background/30">
          BrandGauge. Made for Nigerian and West African brands.
        </p>
      </div>

      {/* ── Right panel: form + demos ──────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex-1 flex flex-col lg:flex-row gap-8 p-6 sm:p-10 lg:p-12 max-w-4xl mx-auto w-full">

          {/* Sign-in form */}
          <div className="flex-1 max-w-sm">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center">
                <BarChart2 className="h-3.5 w-3.5 text-background" />
              </div>
              <span className="font-bold text-[14px]">BrandGauge</span>
            </div>

            <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
            <p className="text-sm text-muted-foreground mb-6">Sign in to your workspace</p>

            <GoogleSignInButton />

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">or with email</span>
              </div>
            </div>

            <form ref={formRef} id="email-login-form" action={action} className="space-y-4">
              {linkExpired && (
                <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-3 py-2 rounded-lg">
                  That reset link has expired. Request a new one below.
                </p>
              )}
              {state?.error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                  {state.error}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@brand.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Forgot?
                  </Link>
                </div>
                <Input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>

              {selectedDemo && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <span>{selectedDemo.icon}</span>
                  <span>Logging in as <strong>{selectedDemo.brand}</strong> demo</span>
                </div>
              )}

              <Button className="w-full" type="submit" form="email-login-form" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {pending ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-5">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-foreground font-medium hover:underline">
                Sign up free
              </Link>
            </p>
          </div>

          {/* Demo accounts */}
          <div className="flex-1 max-w-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Try a live demo</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click any demo to pre-fill credentials, then sign in.
              </p>
            </div>

            <div className="space-y-2">
              {DEMOS.map(demo => (
                <DemoTile
                  key={demo.slug}
                  demo={demo}
                  onSelect={handleDemoSelect}
                  active={selectedDemo?.slug === demo.slug}
                />
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
              Demo accounts contain realistic Nigerian brand data. No credit card needed.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
