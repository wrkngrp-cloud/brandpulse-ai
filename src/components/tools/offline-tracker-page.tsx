'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import { MarketingShell } from '@/components/landing/marketing-shell'
import { ToolField, ToolHero, ToolSelect, ToolSubmit, HowItReads } from './tool-chrome'
import { PrivacyNote, ToolFailure } from './tool-states'
import { BetaContinuation } from './tool-report'
import { nextTool } from '@/lib/tools/registry'
import {
  CAMPAIGN_TYPE_LABEL, CAMPAIGN_TYPES, FREE_PLACEMENT_LIMIT, PLACEMENT_HINT, type CampaignType,
} from '@/lib/tools/campaign-labels'
import { trackTool, useToolAnalytics } from './use-tool-analytics'
import {
  ArrowRightIcon, CheckIcon, CopyIcon, ExternalLinkIcon, InfoIcon, QrIcon,
} from '@/components/brand/icon'
import Link from 'next/link'

interface Placement {
  id: string
  name: string
  slug: string
  utmContent: string
  visits?: number
  uniqueVisits?: number
  trackingUrl: string
  destinationWithUtm: string
}

interface CampaignView {
  id?: string
  campaignId?: string
  name: string
  campaignType: CampaignType
  destinationUrl: string
  market?: string | null
  claimed?: boolean
  responseEnabled?: boolean
}

interface Dashboard {
  campaign: CampaignView
  placements: Placement[]
  recentVisits: { placement_id: string; device_type: string | null; ip_region: string | null; is_unique: boolean; created_at: string }[]
  filteredAutomated: number
}

/**
 * The Offline Campaign Tracker.
 *
 * The only one of the five that writes something permanent on the first click:
 * a slug that is about to be printed on a billboard. So the result page is not
 * a report, it is a set of assets plus a dashboard the visitor can come back
 * to with the link in their address bar — which is how someone who has not
 * signed up reads their numbers a week after the posters went up.
 */
export function OfflineTrackerPage() {
  useToolAnalytics({ event: 'free_tool_viewed', toolId: 'offline-tracker' })
  const tokenFromUrl = useSearchParams().get('c')

  const [name, setName] = useState('')
  const [campaignType, setCampaignType] = useState<CampaignType>('outdoor')
  const [destination, setDestination] = useState('')
  const [market, setMarket] = useState('Nigeria')
  const [placementNames, setPlacementNames] = useState<string[]>([''])
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState<string | null>(tokenFromUrl)
  const [board, setBoard] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadBoard = useCallback(async (t: string) => {
    try {
      const r = await fetch(`/api/tools/offline-tracker?token=${encodeURIComponent(t)}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'That campaign could not be loaded.')
      setBoard(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That campaign could not be loaded.')
    }
  }, [])

  /* Someone arriving on a saved campaign link lands straight on their numbers.
     Written as a promise chain with a liveness flag rather than an awaited
     call, so state is only set from the callback and a token that changes
     mid-flight cannot land the wrong campaign on the page. */
  useEffect(() => {
    if (!tokenFromUrl) return
    let live = true
    fetch(`/api/tools/offline-tracker?token=${encodeURIComponent(tokenFromUrl)}`)
      .then(async r => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        if (!live) return
        if (!ok) setError(data.error ?? 'That campaign could not be loaded.')
        else setBoard(data)
      })
      .catch(() => { if (live) setError('That campaign could not be loaded.') })
    return () => { live = false }
  }, [tokenFromUrl])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/tools/offline-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, campaignType, destinationUrl: destination,
          market: market || undefined,
          placements: placementNames.filter(p => p.trim()).map(p => ({ name: p.trim() })),
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'That did not work.')
      setToken(data.token)
      trackTool({ event: 'free_tool_result_viewed', toolId: 'offline-tracker', runId: data.runId })
      // Put the campaign link in the address bar straight away, so a closed tab
      // does not lose the only way back to these numbers.
      const url = new URL(window.location.href)
      url.searchParams.set('c', data.token)
      window.history.replaceState(null, '', url.toString())
      await loadBoard(data.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally { setBusy(false) }
  }

  const suggestion = nextTool('offline-tracker')

  return (
    <MarketingShell>
      {!board && (
        <>
          <ToolHero headline={<>Know which offline placements are driving responses.</>}>
            Create trackable QR codes and campaign links for billboards, events, radio, flyers
            and activations. Start measuring campaign interactions without connecting any
            marketing accounts.
          </ToolHero>

          <div className="mx-auto max-w-4xl px-6">
            <form onSubmit={create} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ToolField id="ot-name" label="Campaign name" value={name} onChange={setName}
                  placeholder="Q4 Lagos billboards" required
                  hint="Becomes the utm_campaign your own analytics will see." />
                <ToolSelect id="ot-type" label="Campaign type" value={campaignType}
                  onChange={v => setCampaignType(v as CampaignType)}
                  options={CAMPAIGN_TYPES.map(t => ({ value: t, label: CAMPAIGN_TYPE_LABEL[t] }))} />
              </div>
              <ToolField id="ot-dest" label="Where the link should send people" value={destination}
                onChange={setDestination} placeholder="yourbrand.com/offer" required inputMode="url"
                hint="Any parameters already on that address are kept. We only add the UTMs that are missing." />
              <div className="grid gap-3 sm:grid-cols-2">
                <ToolField id="ot-market" label="Market, if you like" value={market} onChange={setMarket}
                  placeholder="Nigeria" />
              </div>

              <div>
                <p className="bg-label" style={{ color: 'var(--lp-mut)' }}>
                  Placements · up to {FREE_PLACEMENT_LIMIT} free
                </p>
                <p className="mt-1.5 text-[12px]" style={{ color: 'var(--lp-mut)' }}>
                  One per site, team or station, so you can tell which of them actually brought
                  people in. Each gets its own link and QR code.
                </p>
                <div className="mt-3 space-y-3">
                  {placementNames.map((p, i) => (
                    <input key={i} value={p}
                      onChange={e => setPlacementNames(ns => ns.map((n, j) => (j === i ? e.target.value : n)))}
                      placeholder={i === 0 ? PLACEMENT_HINT[campaignType] : 'And another'}
                      aria-label={`Placement ${i + 1}`}
                      className="w-full rounded-sm border px-4 py-3 text-[15px] outline-none focus-visible:ring-2"
                      style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)', color: 'var(--lp-ink)' }} />
                  ))}
                </div>
                {placementNames.length < FREE_PLACEMENT_LIMIT && (
                  <button type="button" onClick={() => setPlacementNames(ns => [...ns, ''])}
                    className="mt-3 text-[13px] font-medium" style={{ color: 'var(--tx-flare)' }}>
                    Add another placement
                  </button>
                )}
              </div>

              <ToolSubmit busy={busy} busyLabel="Making your links" label="Create my tracking links"
                disabled={name.trim().length < 2 || destination.trim().length < 4 || !placementNames.some(p => p.trim())} />

              <PrivacyNote>
                We do not ask for an email, and the links work immediately. When someone taps one
                we record that a visit happened, roughly where from and on what kind of device.
                We never store the visitor&apos;s IP address.
              </PrivacyNote>
            </form>

            {error && <div className="mt-10"><ToolFailure title="That did not work" body={error} /></div>}
          </div>

          <HowItReads steps={[
            ['A link and a code per placement', 'Each placement gets its own short link and its own QR code, carrying its own utm_content, so your site analytics can separate them too.'],
            ['Printed means permanent', 'A QR code on a billboard cannot be reissued, so these slugs never change. Continuing in BrandGauge moves the campaign to your workspace and the printed codes keep working.'],
            ['What it measures, and what it cannot', 'It counts the people who actually tapped or scanned. It does not measure how many saw the billboard, and no link tracker can.'],
          ]} />
          <div className="pb-24" />
        </>
      )}

      {board && (
        <div className="mx-auto max-w-4xl px-6 pb-24 pt-36 sm:pt-44">
          <p className="bg-label" style={{ color: 'var(--tx-flare)' }}>Your campaign is live</p>
          <h1 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.02em] sm:text-4xl"
            style={{ fontFamily: 'var(--font)', color: 'var(--lp-ink)' }}>
            {board.campaign.name}
          </h1>
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
            {CAMPAIGN_TYPE_LABEL[board.campaign.campaignType]} · sending people to{' '}
            <a href={board.campaign.destinationUrl} target="_blank" rel="noopener noreferrer"
              className="underline-offset-2 hover:underline" style={{ color: 'var(--tx-flare)' }}>
              {hostOf(board.campaign.destinationUrl)}
            </a>
          </p>

          <div className="mt-6 rounded-sm border p-5"
            style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-chip)' }}>
            <p className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: 'var(--lp-ink)' }}>
              <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tx-flare)' }} />
              <span>
                <span className="font-medium">Keep this page.</span> The address in your browser is
                the only way back to these numbers without an account. Bookmark it, or send it to
                yourself.
              </span>
            </p>
          </div>

          {/* ── The assets ──────────────────────────────────────────── */}
          <div className="mt-8 space-y-5">
            {board.placements.map(p => (
              <PlacementCard key={p.id} placement={p}
                campaignName={board.campaign.name} />
            ))}
          </div>

          {/* ── What has come in ────────────────────────────────────── */}
          <section className="mt-12 border-t pt-8" style={{ borderColor: 'var(--lp-line)' }}>
            <h2 className="text-[17px] font-medium tracking-tight" style={{ color: 'var(--lp-ink)' }}>
              Recorded visits
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
              Totals are every tap or scan. Unique counts one person once a day, because a
              billboard gets the same commuter twice and reporting that as two people would be
              wrong.
            </p>

            <div className="mt-5 overflow-hidden rounded-sm border" style={{ borderColor: 'var(--lp-line)' }}>
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr style={{ background: 'var(--lp-chip)' }}>
                    <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--lp-mut)' }}>Placement</th>
                    <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--lp-mut)' }}>Visits</th>
                    <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--lp-mut)' }}>Unique</th>
                  </tr>
                </thead>
                <tbody>
                  {board.placements.map(p => (
                    <tr key={p.id} className="border-t" style={{ borderColor: 'var(--lp-line)' }}>
                      <td className="px-4 py-2.5" style={{ color: 'var(--lp-ink)' }}>{p.name}</td>
                      <td className="bg-num px-4 py-2.5 text-right" style={{ color: 'var(--lp-ink)' }}>{p.visits ?? 0}</td>
                      <td className="bg-num px-4 py-2.5 text-right" style={{ color: 'var(--lp-ink)' }}>{p.uniqueVisits ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {board.filteredAutomated > 0 && (
              <p className="mt-3 text-[12.5px]" style={{ color: 'var(--lp-mut)' }}>
                And {board.filteredAutomated} we judged automated and left out, mostly link
                previews from WhatsApp and Facebook, which fetch a link once before anyone taps it.
              </p>
            )}

            {board.placements.every(p => !p.visits) && (
              <p className="mt-4 text-[13px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
                Nothing yet. That is expected until the posters are up: the counter moves the first
                time someone scans a code or types a link.
              </p>
            )}

            <p className="mt-6 max-w-2xl text-[12px] leading-relaxed" style={{ color: 'var(--lp-mut)' }}>
              This measures the interactions we instrumented, and nothing else. It is not billboard
              impressions, not reach, not incremental sales, not brand lift and not full campaign
              ROI. Anyone who tells you a QR code measures those is selling you something.
            </p>
          </section>

          <BetaContinuation
            toolId="offline-tracker"
            runToken={token}
            headline="Your tracking links are ready. Campaign visits only tell part of the story."
            body="A visit tells you someone acted. It does not tell you who, or what they wanted. In BrandGauge this campaign keeps its links and its history, and you can add placements without limit, turn on a branded response page with an enquiry form, and see which billboard or activation produced each enquiry."
            primary="Activate campaign response tracking"
          />

          {suggestion && (
            <section className="mt-12 border-t pt-8" style={{ borderColor: 'var(--lp-line)' }}>
              <p className="text-[13.5px]" style={{ color: 'var(--lp-mut)' }}>{suggestion.line}</p>
              <Link href={suggestion.tool.route}
                onClick={() => trackTool({ event: 'free_tool_result_engaged', toolId: 'offline-tracker', props: { to: suggestion.tool.id } })}
                className="mt-2.5 inline-flex items-center gap-2 text-[14px] font-medium"
                style={{ color: 'var(--tx-flare)' }}>
                {suggestion.tool.name} <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </section>
          )}
        </div>
      )}
    </MarketingShell>
  )
}

function PlacementCard({ placement, campaignName }: { placement: Placement; campaignName: string }) {
  const canvasWrap = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  /** The QR as a PNG, at a size that survives print. Taken from the canvas the
   *  component already drew rather than re-rendering it somewhere hidden. */
  function downloadQr() {
    const canvas = canvasWrap.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${slugFile(campaignName)}-${placement.slug}-qr.png`
    a.click()
    trackTool({ event: 'free_tool_result_engaged', toolId: 'offline-tracker', props: { action: 'qr_download' } })
  }

  function copyLink() {
    navigator.clipboard.writeText(placement.trackingUrl)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => {})
  }

  return (
    <article className="rounded-sm border p-6" style={{ borderColor: 'var(--lp-line)', background: 'var(--lp-card)' }}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium" style={{ color: 'var(--lp-ink)' }}>{placement.name}</p>

          <p className="bg-label mt-4" style={{ color: 'var(--lp-mut)' }}>Printed link</p>
          <p className="bg-num mt-1.5 break-all text-[14px]" style={{ color: 'var(--lp-ink)' }}>
            {placement.trackingUrl.replace(/^https?:\/\//, '')}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copyLink}
              className="flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[12.5px] font-medium bg-press"
              style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
              {copied ? <CheckIcon className="h-3.5 w-3.5" style={{ color: 'var(--pos)' }} /> : <CopyIcon className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" onClick={downloadQr}
              className="flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[12.5px] font-medium bg-press"
              style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
              <QrIcon className="h-3.5 w-3.5" /> Download QR
            </button>
            <a href={placement.trackingUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[12.5px] font-medium bg-press"
              style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-ink)' }}>
              <ExternalLinkIcon className="h-3.5 w-3.5" /> Test it
            </a>
          </div>

          <p className="bg-label mt-5" style={{ color: 'var(--lp-mut)' }}>Where it lands</p>
          <p className="mt-1.5 break-all text-[12px]" style={{ color: 'var(--lp-mut)' }}>
            {placement.destinationWithUtm}
          </p>
        </div>

        {/* High error correction, because this is going onto a wall where it
            will be rained on and partly covered. */}
        <div ref={canvasWrap} className="shrink-0 rounded-sm bg-white p-3">
          <QRCodeCanvas value={placement.trackingUrl} size={132} level="H" marginSize={1}
            bgColor="#ffffff" fgColor="#16120e" />
        </div>
      </div>
    </article>
  )
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
function slugFile(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'campaign'
}
