import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncSocialPosts }             from '@/lib/inngest/functions/sync-social-posts'
import { crawlMentions }               from '@/lib/inngest/functions/crawl-mentions'
import { eventRoiReport }              from '@/lib/inngest/functions/event-roi-report'
import { eventVisualDetect }           from '@/lib/inngest/functions/event-visual-detect'
import { oohSearchUplift }             from '@/lib/inngest/functions/ooh-search-uplift'
import { competitiveWeeklyBriefing }   from '@/lib/inngest/functions/competitive-weekly-briefing'
import { ga4DailySync }                from '@/lib/inngest/functions/ga4-daily-sync'
import { appReviewSync }               from '@/lib/inngest/functions/app-review-sync'
import { metaAdsDailySync }            from '@/lib/inngest/functions/meta-ads-daily-sync'
import { prCrawl }                     from '@/lib/inngest/functions/pr-crawl'
import { geoLiftStudy }                from '@/lib/inngest/functions/geo-lift-study'
import { campaignTargetMonitor }       from '@/lib/inngest/functions/campaign-target-monitor'
import { emailConnectorSync }          from '@/lib/inngest/functions/email-connector-sync'
import { panelDailyCheck, panelDispatch } from '@/lib/inngest/functions/panel-dispatch'

export const runtime = 'nodejs'
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncSocialPosts, crawlMentions, eventRoiReport, eventVisualDetect,
    oohSearchUplift, competitiveWeeklyBriefing, ga4DailySync, appReviewSync,
    metaAdsDailySync, prCrawl, geoLiftStudy, campaignTargetMonitor,
    emailConnectorSync, panelDailyCheck, panelDispatch,
  ],
})
