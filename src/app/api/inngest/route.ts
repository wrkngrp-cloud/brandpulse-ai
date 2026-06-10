import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncSocialPosts } from '@/lib/inngest/functions/sync-social-posts'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncSocialPosts],
})
