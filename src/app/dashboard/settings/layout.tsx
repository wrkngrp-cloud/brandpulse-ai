import { PageHeader } from '@/components/dashboard/page-header'
import { PAGE_META } from '@/components/dashboard/page-meta'
import { SettingsNav } from './settings-nav'

/**
 * Settings had its own hand-rolled heading — a different size, a different
 * subtitle treatment and no rule under it — which is exactly the drift
 * PageHeader exists to stop. Same header as every other screen now.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        {...PAGE_META['/dashboard/settings']}
        title="Settings"
        subtitle="Manage your profile, brand, and connected accounts."
      />

      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="shrink-0 md:w-44">
          <SettingsNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
