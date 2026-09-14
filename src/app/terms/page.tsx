import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — BrandGauge',
}

const CONTACT_EMAIL = 'legal@brandgauge.app'
const EFFECTIVE_DATE = 'September 14, 2026'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-sm tracking-tight">
            BrandGauge
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-medium tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>
        </div>

        <p className="text-muted-foreground leading-7">
          These terms cover your use of BrandGauge, a brand intelligence service for marketing
          teams. By creating an account or connecting a platform to BrandGauge, you agree to
          them. If you are agreeing on behalf of a company, you confirm you are allowed to bind
          that company.
        </p>

        <Section title="1. Your account">
          <p>
            You need an account to use BrandGauge. Keep your login details secure and tell us
            promptly if you think someone else has access. You are responsible for what happens
            under your account and for the accuracy of the information you give us.
          </p>
          <p className="mt-3">
            Accounts belong to a workspace. Anyone you invite to your workspace can see the
            brand data in it, so invite with care.
          </p>
        </Section>

        <Section title="2. Connecting your platforms">
          <p>
            BrandGauge reads data from platforms you connect, such as Meta, Google Analytics,
            Google Ads and X. You must own those accounts or have permission from the owner to
            connect them.
          </p>
          <p className="mt-3">
            We only request the access needed to produce your analytics, and we use that access
            for nothing else. You can disconnect any platform at any time from your dashboard,
            or revoke access from the platform directly. Your use of each platform stays
            governed by that platform&apos;s own terms.
          </p>
        </Section>

        <Section title="3. What you may not do">
          <ul className="mt-1 space-y-2 list-disc list-inside text-muted-foreground">
            <li>Connect accounts you do not own or have permission to use</li>
            <li>Resell, sublicense or republish BrandGauge data as your own product</li>
            <li>Reverse engineer the service or try to extract our models or prompts</li>
            <li>Scrape, overload or interfere with the service or its infrastructure</li>
            <li>Upload unlawful content, or use BrandGauge to break any platform&apos;s rules</li>
            <li>Share your login with people outside your workspace</li>
          </ul>
        </Section>

        <Section title="4. Your data stays yours">
          <p>
            You keep all rights to the data you connect or upload. You grant us permission to
            process it only to run the service for you: to calculate your scores, populate your
            dashboards and answer your questions.
          </p>
          <p className="mt-3">
            We do not sell your data, we do not share it with other customers, and we do not use
            it to train AI models. Our{' '}
            <Link href="/privacy-policy" className="text-foreground underline underline-offset-4">
              Privacy Policy
            </Link>{' '}
            sets out the detail.
          </p>
        </Section>

        <Section title="5. AI features">
          <p>
            BrandGauge uses AI to summarise, score and explain your brand data. AI output can be
            wrong or incomplete. Treat it as input to your judgement, not as a final answer, and
            check anything you plan to act on commercially. You stay responsible for decisions
            you make using the service.
          </p>
        </Section>

        <Section title="6. Beta access">
          <p>
            Parts of BrandGauge are offered in beta. Beta features may change, break or be
            withdrawn, and they are provided without the availability commitments that apply to
            generally available features. We will tell you before we remove something you rely on.
          </p>
        </Section>

        <Section title="7. Availability">
          <p>
            We work to keep BrandGauge running and to sync your data on schedule, but we do not
            guarantee uninterrupted service. Connected platforms change their APIs, impose rate
            limits and have outages of their own, which can delay or interrupt a sync.
          </p>
        </Section>

        <Section title="8. Fees">
          <p>
            Paid plans are billed in advance for the period shown at checkout. Fees exclude taxes
            unless stated. If a payment fails we may suspend access until it is settled. During
            beta, access may be provided at no charge, and we will give you clear notice before
            any charge begins.
          </p>
        </Section>

        <Section title="9. Ending your use">
          <p>
            You can stop using BrandGauge and close your account at any time by emailing us. We
            may suspend or close an account that breaches these terms, that puts the service or
            other customers at risk, or where we are required to by law.
          </p>
          <p className="mt-3">
            When an account closes we delete its data within 30 days, except where we must keep
            records to meet a legal obligation.
          </p>
        </Section>

        <Section title="10. Liability">
          <p>
            BrandGauge is provided as is. To the extent the law allows, we are not liable for
            indirect or consequential loss, lost profits, lost revenue or lost data. Our total
            liability for any claim is capped at the fees you paid us in the 12 months before the
            claim arose.
          </p>
          <p className="mt-3">
            Nothing here limits liability that cannot be limited by law.
          </p>
        </Section>

        <Section title="11. Changes to these terms">
          <p>
            We may update these terms as the service develops. If a change materially affects
            your rights we will give you reasonable notice by email or in the app. Continued use
            after a change takes effect means you accept it.
          </p>
        </Section>

        <Section title="12. Governing law">
          <p>
            These terms are governed by the laws of the Federal Republic of Nigeria, and the
            courts of Lagos State have jurisdiction over any dispute. We would much rather sort
            things out by talking first, so please contact us before escalating.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these terms? Reach us at{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-foreground underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <div className="border-t pt-8 text-xs text-muted-foreground">
          BrandGauge, Lagos, Nigeria.
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="text-muted-foreground leading-7 space-y-3">{children}</div>
    </section>
  )
}
