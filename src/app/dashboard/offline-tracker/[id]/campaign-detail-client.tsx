'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import { toast } from 'sonner'
import {
  CheckIcon, CopyIcon, ExportIcon, ExternalLinkIcon, InfoIcon, PlusIcon, QrIcon,
} from '@/components/brand/icon'
import { Working } from '@/components/brand/working'
import { CAMPAIGN_TYPE_LABEL, type CampaignType } from '@/lib/tools/campaign-labels'

interface Placement {
  id: string
  name: string
  slug: string
  utm_content: string
  visits: number
  unique_visits: number
  trackingUrl: string
  destinationWithUtm: string
}

interface Response {
  id: string
  placement_id: string | null
  name: string | null
  email: string | null
  phone: string | null
  message: string | null
  wants_callback: boolean
  consented_at: string
  created_at: string
}

interface Visit {
  placement_id: string
  device_type: string | null
  ip_region: string | null
  is_unique: boolean
  is_bot: boolean
  created_at: string
}

interface Campaign {
  id: string
  name: string
  campaignType: CampaignType
  destinationUrl: string
  market: string | null
  responseEnabled: boolean
  responseHeadline: string | null
  responseBlurb: string | null
}

/**
 * The campaign workspace.
 *
 * The comparison table is the point of the whole tool: which placement earned
 * its money. It reports visits, uniques and enquiries side by side, and says
 * in the same breath what none of those numbers are, because a marketer
 * presenting billboard performance upstairs will be asked for reach and needs
 * to know this is not it.
 */
export function CampaignDetailClient({
  brandName, campaign, placements: initialPlacements, responses, visits,
}: {
  brandName: string
  campaign: Campaign
  placements: Placement[]
  responses: Response[]
  visits: Visit[]
}) {
  const claimed = useSearchParams().get('claimed')
  const [placements, setPlacements] = useState(initialPlacements)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)

  const [responseEnabled, setResponseEnabled] = useState(campaign.responseEnabled)
  const [headline, setHeadline] = useState(campaign.responseHeadline ?? '')
  const [blurb, setBlurb] = useState(campaign.responseBlurb ?? '')
  const [savingSettings, setSavingSettings] = useState(false)

  const byPlacement = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of responses) {
      if (!r.placement_id) continue
      counts.set(r.placement_id, (counts.get(r.placement_id) ?? 0) + 1)
    }
    return counts
  }, [responses])

  const bots = visits.filter(v => v.is_bot).length
  const totalVisits = placements.reduce((n, p) => n + p.visits, 0)
  const totalUniques = placements.reduce((n, p) => n + p.unique_visits, 0)

  async function addPlacement(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/campaigns/offline/placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id, name: newName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'That did not save.')
      setPlacements(ps => [...ps, {
        ...data.placement,
        destinationWithUtm: campaign.destinationUrl,
        visits: 0, unique_visits: 0,
      }])
      setNewName(''); setAdding(false)
      toast.success(`${data.placement.name} is tracking. Its code is ready to print.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That did not save.')
    } finally { setBusy(false) }
  }

  async function saveSettings(nextEnabled?: boolean) {
    setSavingSettings(true)
    const enabled = nextEnabled ?? responseEnabled
    try {
      const res = await fetch('/api/campaigns/offline/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          responseEnabled: enabled,
          responseHeadline: headline,
          responseBlurb: blurb,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'That did not save.')
      setResponseEnabled(enabled)
      toast.success(enabled
        ? 'Response page is live. Your codes now land there first.'
        : 'Response page off. Your codes go straight to your destination again.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That did not save.')
    } finally { setSavingSettings(false) }
  }

  function exportCsv() {
    const header = ['Placement', 'Tracking URL', 'Visits', 'Unique visits', 'Enquiries']
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const body = placements.map(p => [
      p.name, p.trackingUrl, p.visits, p.unique_visits, byPlacement.get(p.id) ?? 0,
    ].map(esc).join(','))
    const notes = [
      '',
      esc('These are instrumented interactions only: taps and scans of the links above.'),
      esc('Not billboard impressions, not reach, not incremental sales, not brand lift, not full campaign ROI.'),
      esc(`${bots} automated hits were recorded and excluded from these figures.`),
    ]
    const csv = [header.join(','), ...body, ...notes].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-placements.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {claimed === 'offline-tracker' && (
        <div className="rounded-sm border border-line bg-flare-wash p-4">
          <p className="flex items-center gap-2 text-[14px] font-medium text-tx">
            <CheckIcon className="h-4 w-4 text-pos" /> This campaign is yours now
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tx-2">
            Nothing was copied and nothing was reissued: the same rows moved into your workspace,
            so every code you have already printed still works and the visits it recorded are
            below. You can add placements without limit from here.
          </p>
        </div>
      )}

      {/* ── Which placement earned its money ───────────────────────── */}
      <section data-tour="offline-comparison" className="rounded-sm border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-medium text-tx">Placement comparison</h2>
            <p className="mt-0.5 text-[12.5px] text-tx-3">
              {CAMPAIGN_TYPE_LABEL[campaign.campaignType]} · {totalVisits} {totalVisits === 1 ? 'visit' : 'visits'}, {totalUniques} unique
              {responses.length > 0 && `, ${responses.length} ${responses.length === 1 ? 'enquiry' : 'enquiries'}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAdding(a => !a)}
              className="flex items-center gap-1.5 rounded-sm border border-line px-3.5 py-2 text-[13px] font-medium text-tx bg-press">
              <PlusIcon className="h-3.5 w-3.5" /> Add placement
            </button>
            <button type="button" onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-sm border border-line px-3.5 py-2 text-[13px] font-medium text-tx bg-press">
              <ExportIcon className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        {adding && (
          <form onSubmit={addPlacement} className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="new-placement" className="bg-label block text-tx-3">Placement name</label>
              <input id="new-placement" value={newName} onChange={e => setNewName(e.target.value)} required
                placeholder="Third Mainland Bridge, northbound"
                className="mt-2 w-full rounded-sm border border-line bg-paper px-3.5 py-2.5 text-[14px] text-tx outline-none focus-visible:ring-2" />
            </div>
            <button type="submit" disabled={busy || newName.trim().length < 1}
              className="flex items-center justify-center gap-2 rounded-sm bg-flare px-5 py-2.5 text-[13.5px] font-bold text-on-hot bg-press disabled:opacity-50">
              {busy ? <><Working className="h-4 w-4" /> Making the code</> : 'Add and make its code'}
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="bg-shell">
                <th className="px-5 py-2.5 font-medium text-tx-3">Placement</th>
                <th className="px-5 py-2.5 text-right font-medium text-tx-3">Visits</th>
                <th className="px-5 py-2.5 text-right font-medium text-tx-3">Unique</th>
                <th className="px-5 py-2.5 text-right font-medium text-tx-3">Enquiries</th>
              </tr>
            </thead>
            <tbody>
              {placements.map(p => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-5 py-2.5 text-tx">{p.name}</td>
                  <td className="bg-num px-5 py-2.5 text-right text-tx">{p.visits}</td>
                  <td className="bg-num px-5 py-2.5 text-right text-tx">{p.unique_visits}</td>
                  <td className="bg-num px-5 py-2.5 text-right text-tx">{byPlacement.get(p.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-line px-5 py-4">
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-tx-3">
            <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              These are the interactions we instrumented: taps and scans of your links. They are
              not billboard impressions, not reach, not incremental sales, not brand lift and not
              full campaign ROI. Unique counts one person once a day.
              {bots > 0 && ` ${bots} automated hits, mostly WhatsApp and Facebook link previews, were recorded and left out.`}
            </span>
          </p>
        </div>
      </section>

      {/* ── The assets ─────────────────────────────────────────────── */}
      <section data-tour="offline-assets" className="space-y-3">
        <h2 className="text-[15px] font-medium text-tx">Links and codes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {placements.map(p => <AssetCard key={p.id} placement={p} campaignName={campaign.name} />)}
        </div>
      </section>

      {/* ── Response capture ───────────────────────────────────────── */}
      <section data-tour="offline-responses" className="rounded-sm border border-line bg-card p-5">
        <h2 className="text-[15px] font-medium text-tx">Response page and enquiries</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-tx-2">
          A visit tells you someone acted. An enquiry tells you what they wanted. Turn this on and
          your printed codes land on a page branded for {brandName} that carries your destination
          as its main button and an enquiry form underneath, tagged with the placement they came
          from.
        </p>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-tx-3">
          It changes where your codes land, so it is off until you switch it on. Enquiries are
          only stored when the person ticks the consent box, and the exact wording they agreed to
          is stored with their details.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="rp-head" className="bg-label block text-tx-3">Page headline</label>
            <input id="rp-head" value={headline} onChange={e => setHeadline(e.target.value)}
              placeholder={`${campaign.name}`} maxLength={120}
              className="mt-2 w-full rounded-sm border border-line bg-paper px-3.5 py-2.5 text-[14px] text-tx outline-none focus-visible:ring-2" />
          </div>
          <div>
            <label htmlFor="rp-blurb" className="bg-label block text-tx-3">A line or two under it</label>
            <textarea id="rp-blurb" value={blurb} onChange={e => setBlurb(e.target.value)} rows={2} maxLength={400}
              placeholder="What this campaign is offering, in plain words."
              className="mt-2 w-full rounded-sm border border-line bg-paper px-3.5 py-2.5 text-[14px] text-tx outline-none focus-visible:ring-2" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={savingSettings} onClick={() => saveSettings(!responseEnabled)}
              className="flex items-center gap-2 rounded-sm px-5 py-2.5 text-[13.5px] font-bold bg-press disabled:opacity-50"
              style={responseEnabled
                ? { borderWidth: 1, borderColor: 'var(--line)', color: 'var(--tx)' }
                : { background: 'var(--flare)', color: 'var(--on-hot)' }}>
              {savingSettings && <Working className="h-4 w-4" />}
              {responseEnabled ? 'Turn the response page off' : 'Activate campaign response tracking'}
            </button>
            {responseEnabled && (
              <>
                <button type="button" disabled={savingSettings} onClick={() => saveSettings()}
                  className="rounded-sm border border-line px-4 py-2.5 text-[13px] font-medium text-tx bg-press">
                  Save the wording
                </button>
                <a href={`/respond/${campaign.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[13px] font-medium text-tx-flare">
                  <ExternalLinkIcon className="h-3.5 w-3.5" /> See the page
                </a>
              </>
            )}
          </div>
        </div>

        {responses.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="bg-label text-tx-3">{responses.length} {responses.length === 1 ? 'enquiry' : 'enquiries'}</p>
            <ul className="mt-3 divide-y divide-line">
              {responses.map(r => {
                const placement = placements.find(p => p.id === r.placement_id)
                return (
                  <li key={r.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[14px] font-medium text-tx">{r.name ?? 'No name given'}</p>
                      <p className="text-[12px] text-tx-3">
                        {placement ? placement.name : 'Placement unknown'} ·{' '}
                        {new Date(r.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <p className="mt-1 text-[13px] text-tx-2">
                      {[r.phone, r.email].filter(Boolean).join(' · ') || 'No contact details'}
                      {r.wants_callback && ' · asked for a call back'}
                    </p>
                    {r.message && <p className="mt-1.5 text-[13px] leading-relaxed text-tx">{r.message}</p>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

function AssetCard({ placement, campaignName }: { placement: Placement; campaignName: string }) {
  const [copied, setCopied] = useState(false)

  function downloadQr(e: React.MouseEvent<HTMLButtonElement>) {
    const canvas = e.currentTarget.closest('[data-asset]')?.querySelector('canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${placement.slug}-qr.png`
    a.click()
  }

  return (
    <article data-asset className="rounded-sm border border-line bg-card p-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-tx">{placement.name}</p>
          <p className="bg-num mt-2 break-all text-[12.5px] text-tx-2">
            {placement.trackingUrl.replace(/^https?:\/\//, '')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button"
              onClick={() => {
                navigator.clipboard.writeText(placement.trackingUrl)
                  .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
                  .catch(() => {})
              }}
              className="flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 text-[12px] font-medium text-tx bg-press">
              {copied ? <CheckIcon className="h-3 w-3 text-pos" /> : <CopyIcon className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={downloadQr}
              className="flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 text-[12px] font-medium text-tx bg-press">
              <QrIcon className="h-3 w-3" /> QR
            </button>
          </div>
        </div>
        <div className="shrink-0 rounded-sm bg-white p-2">
          <QRCodeCanvas value={placement.trackingUrl} size={88} level="H" marginSize={1}
            bgColor="#ffffff" fgColor="#16120e" />
        </div>
      </div>
    </article>
  )
}
