import { fetchTwitterKeywordMentions } from '@/lib/social/twitter'
import { fetchInstagramHashtagMentions } from '@/lib/social/instagram'
import { decrypt } from '@/lib/crypto'

function deriveHashtags(name: string): string[] {
  const slug  = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  const first = name.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '')
  return [...new Set([slug, first])].filter(h => h.length > 2)
}

interface Connection {
  platform:     string
  account_id:   string | null
  account_name: string | null
  access_token: string | null
}

export interface CompetitorVolumes {
  [competitorName: string]: number
}

/**
 * For each competitor, count how many times their brand name appeared on
 * Twitter and Instagram in the `since` window using the brand's own OAuth
 * connections. Returns a map of competitor name → mention count.
 *
 * Counts only — competitor content is never stored in the DB.
 */
export async function crawlCompetitorVolumes(
  competitors: { id: string; name: string }[],
  connections: Connection[],
  since: Date,
): Promise<CompetitorVolumes> {
  const twitterConn  = connections.find(c => c.platform === 'twitter')
  const instagramConn = connections.find(c => c.platform === 'instagram')

  const volumes: CompetitorVolumes = {}

  for (const competitor of competitors) {
    let count = 0

    // ── Twitter keyword search ───────────────────────────────────────────────
    if (twitterConn?.account_id && twitterConn.access_token) {
      try {
        const accessToken = decrypt(twitterConn.access_token)
        const brandHandle = (twitterConn.account_name ?? '').replace(/^@/, '')
        const tweets = await fetchTwitterKeywordMentions(
          competitor.name,
          brandHandle,
          accessToken,
          since,
        )
        count += tweets.length
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // X_CREDITS_DEPLETED or 402 just means no results — non-fatal
        if (!msg.includes('X_CREDITS_DEPLETED') && !msg.includes('402')) {
          console.warn(`[crawlCompetitors] Twitter search for "${competitor.name}" failed:`, msg)
        }
      }
    }

    // ── Instagram hashtag search ─────────────────────────────────────────────
    if (instagramConn?.account_id && instagramConn.access_token) {
      try {
        const igToken  = decrypt(instagramConn.access_token)
        const hashtags = deriveHashtags(competitor.name)
        const posts    = await fetchInstagramHashtagMentions(
          instagramConn.account_id,
          igToken,
          hashtags,
          since,
        )
        count += posts.length
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[crawlCompetitors] Instagram search for "${competitor.name}" failed:`, msg)
      }
    }

    volumes[competitor.name] = count
  }

  return volumes
}
