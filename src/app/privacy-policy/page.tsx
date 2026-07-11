import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — BrandGauge',
}

const CONTACT_EMAIL = 'privacy@brandgauge.app'
const EFFECTIVE_DATE = 'June 11, 2026'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-sm tracking-tight">
            BrandGauge
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>
        </div>

        <p className="text-muted-foreground leading-7">
          BrandGauge helps Nigerian and West African marketing teams understand how their
          brands are perceived online. This policy explains what data we collect when you connect
          your social accounts, how we store it, and the rights you have over it.
        </p>

        <Section title="1. What we collect">
          <p>
            When you connect a social account (Instagram, Facebook, or X/Twitter), we collect:
          </p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-muted-foreground">
            <li>Your account name, account ID, and follower count</li>
            <li>Post content, media URLs, and publication dates</li>
            <li>Public engagement metrics — likes, comments, shares, saves, impressions, and reach</li>
            <li>Public mentions of your connected brand name on X/Twitter</li>
            <li>OAuth access tokens that allow us to fetch the above on your behalf</li>
          </ul>
          <p className="mt-3">
            We do not collect private messages, follower lists, personal information about your
            audience, or any data that is not directly related to your brand&apos;s public performance.
          </p>
        </Section>

        <Section title="2. How we use it">
          <p>We use the data you share exclusively to power your BrandGauge workspace:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-muted-foreground">
            <li>Calculating your Brand Health Index, sentiment scores, and share of voice</li>
            <li>Populating your Content Performance table and analytics dashboards</li>
            <li>Running AI-powered brand health questions through the Ask AI feature</li>
            <li>Scoring content before posting with the Pre-Post Widget</li>
          </ul>
          <p className="mt-3">
            Your data is never used to train AI models, shared with other BrandGauge customers,
            or used for any purpose outside your workspace.
          </p>
        </Section>

        <Section title="3. How we store it">
          <p>
            All data is stored in a secured, encrypted Postgres database hosted on Supabase with
            servers in the EU West region. Access is enforced at the row level — only members of
            your workspace can read your data.
          </p>
          <p className="mt-3">
            OAuth access tokens are encrypted at rest using AES-256-GCM before storage and are
            never returned to the client or exposed via any API endpoint. They are decrypted
            server-side only when needed to sync your data.
          </p>
          <p className="mt-3">
            Data is synced nightly. We retain your data for as long as your account is active.
          </p>
        </Section>

        <Section title="4. We never sell your data">
          <p>
            BrandGauge does not sell, rent, license, or otherwise transfer your data to any
            third party for commercial purposes. Full stop.
          </p>
          <p className="mt-3">
            We use a small number of sub-processors to operate the service — including Supabase
            (database), Vercel (hosting), Anthropic (AI inference), and Upstash (caching). Each
            processes data only as instructed and under strict data processing agreements. None
            of them receive your data for their own commercial use.
          </p>
        </Section>

        <Section title="5. Third-party platforms">
          <p>
            Connecting a social account means BrandGauge accesses data from that platform on
            your behalf. Your use of those platforms remains governed by their own terms and
            privacy policies:
          </p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-muted-foreground">
            <li>Meta (Facebook and Instagram): facebook.com/policy.php</li>
            <li>X (Twitter): x.com/en/privacy</li>
          </ul>
          <p className="mt-3">
            You can revoke BrandGauge&apos;s access to any platform at any time from that
            platform&apos;s app permissions settings, independently of deleting your BrandGauge account.
          </p>
        </Section>

        <Section title="6. Your rights and data deletion">
          <p>You have the right to:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-muted-foreground">
            <li>Access a copy of all data we hold about your workspace</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your account and all associated data</li>
            <li>Disconnect any social account at any time from your dashboard</li>
          </ul>
          <p className="mt-3">
            To request data access or deletion, email us at{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-foreground underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            . We will respond within 5 business days and complete any deletion request within 30
            days.
          </p>
        </Section>

        <Section title="7. Contact">
          <p>
            If you have any questions about this policy, reach us at{' '}
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
          BrandGauge &mdash; Lagos, Nigeria. This policy may be updated from time to time.
          Continued use of the service after changes constitutes acceptance.
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-muted-foreground leading-7 space-y-3">{children}</div>
    </section>
  )
}
