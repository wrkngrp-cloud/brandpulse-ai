import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncSocialPosts } from '@/lib/inngest/functions/sync-social-posts'
import { crawlMentions } from '@/lib/inngest/functions/crawl-mentions'

export const runtime = 'nodejs'
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncSocialPosts, crawlMentions],
})
