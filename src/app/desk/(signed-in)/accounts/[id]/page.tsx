import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/desk/auth'
import { deskHref } from '@/lib/desk/urls'
import { accountDetail } from '@/lib/desk/accounts'
import { adoptionForBrand, adoptionHeadline } from '@/lib/desk/adoption'
import { PageHeader } from '@/components/dashboard/page-header'
import { ArrowLeftIcon, BuildingIcon, ConnectIcon, HistoryIcon, UsersIcon } from '@/components/brand/icon'
import { sessionsForWorkspace } from '@/lib/desk/impersonation'
import { changePlan } from './actions'
import { NoteBox } from './note-box'
import { AccessRequest } from './access-request'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PLANS = ['starter', 'growth', 'pro', 'agency', 'enterprise']

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireStaff('accounts.view', {
    action: 'accounts.detail_view', targetType: 'workspace', targetId: id, workspaceId: id,
    summary: 'Opened an account',
  })

  const account = await accountDetail(session, id)
  if (!account) notFound()

  // Adoption is per brand, because the weights are per brand_type. The first
  // brand is the one shown; a multi-brand workspace gets a switcher later.
  const primaryBrand = account.brands[0]
  const adoption = primaryBrand ? await adoptionForBrand(session, primaryBrand.id) : null
  const headline = adoption ? adoptionHeadline(adoption) : null
  const accessSessions = await sessionsForWorkspace(session, account.workspaceId)

  const limits = account.planLimits
  const callsAgainstLimit = limits && limits.aiCallsMo > 0
    ? Math.round((account.aiCallsMtd / limits.aiCallsMo) * 100)
    : null

  return (
    <div className="space-y-8">
      <Link href={await deskHref('/desk/accounts')} className="bg-press inline-flex items-center gap-1.5 text-xs text-tx-3">
        <ArrowLeftIcon className="size-3.5" /> Accounts
      </Link>

      <PageHeader
        eyebrow={account.plan}
        title={account.name}
        subtitle={[
          `${account.seats} ${account.seats === 1 ? 'person' : 'people'}`,
          `${account.brands.length} ${account.brands.length === 1 ? 'brand' : 'brands'}`,
          `joined ${when(account.createdAt)}`,
        ].join(' · ')}
        icon={BuildingIcon}
        actions={
          session.can('accounts.plan_change') ? (
            <form action={changePlan} className="flex items-center gap-1.5">
              <input type="hidden" name="workspace_id" value={account.workspaceId} />
              <select
                name="plan" defaultValue={account.plan}
                className="h-8 rounded-md border border-line bg-paper px-2 text-xs"
              >
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button type="submit" className="bg-press rounded-md border border-line px-2 py-1 text-xs">
                Change plan
              </button>
            </form>
          ) : null
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Readout label="Brand health" value={account.bhi === null ? 'Not computed' : String(account.bhi)} />
        <Readout
          label="Modules, 30 days" value={String(account.modulesUsed30)}
          note={adoption ? `${adoption.used.length} of ${adoption.used.length + adoption.recommended.length} relevant` : undefined}
        />
        <Readout
          label="AI calls this month" value={String(account.aiCallsMtd)}
          note={
            callsAgainstLimit !== null
              ? `${callsAgainstLimit}% of the ${account.plan} limit`
              : limits?.aiCallsMo === -1 ? 'no limit on this plan' : undefined
          }
        />
        <Readout
          label="What they cost us"
          value={account.aiCostMtd === null ? 'Hidden on your role' : `$${account.aiCostMtd.toFixed(2)}`}
          note={account.aiCostMtd === null ? undefined : 'month to date'}
        />
      </section>

      {headline && (
        <p className="rounded-xl border border-line bg-shell p-4 text-sm">{headline}</p>
      )}

      {adoption && (
        <section className="space-y-3">
          <h2 className="bg-label text-[0.7rem] text-tx-3">
            Adoption for {adoption.brandName}
            {adoption.brandType ? ` (${adoption.brandType.replace(/_/g, ' ')})` : ''}
          </h2>

          <div className="grid gap-3 lg:grid-cols-3">
            <AdoptionList
              title="Should be using"
              empty="Nothing relevant is going unused."
              items={adoption.recommended}
              tone="recommend"
            />
            <AdoptionList
              title="Blocked on a prerequisite"
              empty="Nothing is waiting on a connector."
              items={adoption.blocked}
              tone="blocked"
            />
            <AdoptionList
              title="In use"
              empty="Nothing opened in 30 days."
              items={adoption.used}
              tone="used"
            />
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-3">
          <h2 className="bg-label flex items-center gap-1.5 text-[0.7rem] text-tx-3">
            <HistoryIcon className="size-3.5" /> Timeline
          </h2>
          {account.timeline.length === 0 ? (
            <p className="rounded-xl border border-line bg-card p-4 text-sm text-tx-3">
              Nothing recorded.
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
              {account.timeline.map((event, i) => (
                <li key={`${event.at}-${i}`} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                  <span className="text-tx-2">{event.label}</span>
                  <time className="bg-num shrink-0 text-xs text-tx-3" dateTime={event.at}>
                    {when(event.at)}
                  </time>
                </li>
              ))}
            </ul>
          )}

          {session.can('accounts.note') && <NoteBox workspaceId={account.workspaceId} />}

          {session.can('accounts.impersonate') && (
            <AccessRequest
              workspaceId={account.workspaceId}
              accountName={account.name}
              sessions={accessSessions.map(s => ({
                id: s.id, staffName: s.staffName, reason: s.reason, status: s.status,
                createdAt: s.createdAt, endedAt: s.endedAt, endedBy: s.endedBy,
                pagesViewed: s.pagesViewed, expiresAt: s.expiresAt,
              }))}
            />
          )}

          {account.notes.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
              {account.notes.map(note => (
                <li key={note.id} className="px-4 py-3">
                  <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                  <p className="mt-1 text-xs text-tx-3">
                    {note.authorName} · {when(note.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-6 text-sm">
          <div className="space-y-2">
            <h2 className="bg-label flex items-center gap-1.5 text-[0.7rem] text-tx-3">
              <ConnectIcon className="size-3.5" /> Connected
            </h2>
            {account.connectorList.length === 0 ? (
              <p className="rounded-xl border border-line bg-card p-3 text-xs text-tx-3">
                Nothing connected. Every number in the product comes from a connector or a
                survey, so this is the first thing to fix.
              </p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
                {account.connectorList.map((c, i) => (
                  <li key={`${c.label}-${c.detail}-${i}`} className="px-3 py-2">
                    <p className="text-xs">
                      {c.label}{c.detail ? ` · ${c.detail}` : ''}
                    </p>
                    <p className="text-[0.7rem] text-tx-3">
                      {c.brandName}
                      {c.status ? ` · ${c.status}` : ''}
                      {c.lastSyncAt ? ` · synced ${when(c.lastSyncAt)}` : ' · never synced'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="bg-label flex items-center gap-1.5 text-[0.7rem] text-tx-3">
              <UsersIcon className="size-3.5" /> People
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
              {account.people.map(person => (
                <li key={person.userId} className="px-3 py-2">
                  <p className="text-xs">{person.email || 'no address on file'}</p>
                  <p className="text-[0.7rem] text-tx-3">
                    {person.role}
                    {person.lastSeenAt ? ` · signed in ${when(person.lastSeenAt)}` : ' · never signed in'}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {account.usageByTier.length > 0 && (
            <div className="space-y-2">
              <h2 className="bg-label text-[0.7rem] text-tx-3">AI by tier, this month</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
                {account.usageByTier.map(row => (
                  <li key={row.tier} className="flex justify-between px-3 py-2 text-xs">
                    <span>{row.tier}</span>
                    <span className="bg-num">
                      {row.calls}
                      {row.costUsd !== null && <span className="ml-2 text-tx-3">${row.costUsd.toFixed(2)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {account.usageByFeature.length > 0 && (
            <div className="space-y-2">
              <h2 className="bg-label text-[0.7rem] text-tx-3">Most used AI features</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
                {account.usageByFeature.map(row => (
                  <li key={row.feature} className="flex justify-between px-3 py-2 text-xs">
                    <span className={cn(row.feature === 'unattributed' && 'text-tx-3')}>
                      {row.feature}
                    </span>
                    <span className="bg-num">{row.calls}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Readout({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="bg-label text-[0.65rem] text-tx-3">{label}</p>
      <p className="bg-num mt-1.5 text-2xl">{value}</p>
      {note && <p className="mt-1 text-xs text-tx-3">{note}</p>}
    </div>
  )
}

function AdoptionList({
  title, items, empty, tone,
}: {
  title: string
  items: { key: string; label: string; component: string | null; weight: number; views30: number; missing: string | null }[]
  empty: string
  tone: 'recommend' | 'blocked' | 'used'
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <p className="border-b border-line px-3 py-2 text-xs font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-xs text-tx-3">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map(item => (
            <li key={item.key} className="px-3 py-2">
              <p className="text-xs">{item.label}</p>
              <p className="text-[0.7rem] text-tx-3">
                {tone === 'used'
                  ? `${item.views30} ${item.views30 === 1 ? 'view' : 'views'} in 30 days`
                  : tone === 'blocked'
                    ? `needs ${item.missing}`
                    : item.component
                      ? `feeds ${item.component}, weighted ${item.weight}`
                      : 'does not move the index'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
