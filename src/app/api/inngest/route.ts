import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncSocialPosts }             from '@/lib/inngest/functions/sync-social-posts'
import { crawlMentions }               from '@/lib/inngest/functions/crawl-mentions'
import { eventRoiReport }              from '@/lib/inngest/functions/event-roi-report'
import { eventVisualDetect }           from '@/lib/inngest/functions/event-visual-detect'
import { oohSearchUplift }             from '@/lib/inngest/functions/ooh-search-uplift'
import { competitiveWeeklyBriefing }   from '@/lib/inngest/functions/competitive-weekly-briefing'

export const runtime = 'nodejs'
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncSocialPosts, crawlMentions, eventRoiReport, eventVisualDetect, oohSearchUplift, competitiveWeeklyBriefing],
})
