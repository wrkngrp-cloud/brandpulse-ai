import { createClient } from '@/lib/supabase/server'
import { bannerFor } from '@/lib/desk/impersonation'
import { endImpersonation } from '@/lib/desk/impersonation-actions'
import { EyeIcon } from '@/components/brand/icon'

/**
 * The banner that runs for the whole of a read-only session.
 *
 * Both sides see it, and the customer can end it from here. Flare fills the
 * plane and the type on it is ink, because paper on Flare fails contrast and
 * ink passes.
 *
 * Renders nothing when no session is live, which is almost always, so it costs
 * one indexed query on a page nobody is being watched on.
 */
export async function ImpersonationBanner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const banner = await bannerFor(user.id)
  if (!banner) return null

  const minutesLeft = Math.max(
    0, Math.round((new Date(banner.expiresAt).getTime() - Date.now()) / 60000),
  )

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-flare px-4 py-2 text-on-hot">
      <p className="flex items-center gap-2 text-sm">
        <EyeIcon className="size-4" />
        {banner.viewerIsStaff ? (
          <span>
            You are viewing <span className="font-medium">{banner.workspaceName}</span> read
            only. Nothing you do here can change their data.
          </span>
        ) : (
          <span>
            <span className="font-medium">{banner.staffName}</span> from BrandGauge is viewing
            your account, read only, with your permission.
          </span>
        )}
        <span className="bg-num text-xs">
          {minutesLeft} {minutesLeft === 1 ? 'minute' : 'minutes'} left
        </span>
      </p>

      <form action={endImpersonation}>
        <input type="hidden" name="session_id" value={banner.sessionId} />
        <input type="hidden" name="ended_by" value={banner.viewerIsStaff ? 'staff' : 'customer'} />
        <button
          type="submit"
          className="bg-press rounded-md border border-on-hot/30 px-2.5 py-1 text-xs font-medium"
        >
          End now
        </button>
      </form>
    </div>
  )
}
