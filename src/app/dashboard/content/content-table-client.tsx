'use client'

import { useOptimistic, useTransition } from 'react'
import { ContentTable, type SocialPost } from '@/components/dashboard/content-table'
import { toast } from 'sonner'

export function ContentTableClient({ posts }: { posts: SocialPost[] }) {
  const [optimisticPosts, updateOptimistic] = useOptimistic(
    posts,
    (state, { id, stage }: { id: string; stage: string }) =>
      state.map(p => p.id === id ? { ...p, funnel_stage: stage } : p)
  )
  const [, startTransition] = useTransition()

  async function handleFunnelStageChange(postId: string, stage: string) {
    startTransition(() => {
      updateOptimistic({ id: postId, stage })
    })
    const res = await fetch('/api/social/posts/funnel-stage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, stage }),
    })
    if (!res.ok) toast.error('Failed to save funnel stage')
  }

  return (
    <ContentTable
      posts={optimisticPosts}
      onFunnelStageChange={handleFunnelStageChange}
    />
  )
}
