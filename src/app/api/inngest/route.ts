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
import { panelDailyCheck, panelDispatch }       from '@/lib/inngest/functions/panel-dispatch'
import { monthlyReportCron, weeklyDigestCron }  from '@/lib/inngest/functions/scheduled-reports'
import { youtubeBrandMonitor }         from '@/lib/inngest/functions/youtube-brand-monitor'
import { whatsappBroadcast }           from '@/lib/inngest/functions/whatsapp-broadcast'
import { aiVisibilityWeeklyCron, aiVisibilityOnDemand } from '@/lib/inngest/functions/ai-visibility'
import { googleMapsSync }              from '@/lib/inngest/functions/google-maps-sync'
import { volumeSurgeCheck }            from '@/lib/inngest/functions/volume-surge-check'
import { regulatoryMentionDetect }     from '@/lib/inngest/functions/regulatory-mention-detect'
import { reviewAspectClassifier }      from '@/lib/inngest/functions/review-aspect-classifier'
import { b2bReviewSync }               from '@/lib/inngest/functions/b2b-review-sync'
import { developerHealthSync }         from '@/lib/inngest/functions/developer-health-sync'

export const runtime = 'nodejs'
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncSocialPosts, crawlMentions, eventRoiReport, eventVisualDetect,
    oohSearchUplift, competitiveWeeklyBriefing, ga4DailySync, appReviewSync,
    metaAdsDailySync, prCrawl, geoLiftStudy, campaignTargetMonitor,
    emailConnectorSync, panelDailyCheck, panelDispatch,
    monthlyReportCron, weeklyDigestCron,
    youtubeBrandMonitor,
    whatsappBroadcast,
    aiVisibilityWeeklyCron, aiVisibilityOnDemand,
    googleMapsSync,
    volumeSurgeCheck,
    regulatoryMentionDetect,
    reviewAspectClassifier,
    b2bReviewSync,
    developerHealthSync,
  ],
})
