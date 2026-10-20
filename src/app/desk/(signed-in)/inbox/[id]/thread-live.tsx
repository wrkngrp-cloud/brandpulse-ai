'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Keeps one conversation current while it is open.
 *
 * It renders nothing and refreshes the route rather than fetching messages
 * itself, for one reason worth stating: attachment links are signed per view
 * and expire in a minute, and signing needs the service role. Re-running the
 * server component keeps that where it belongs and means there is one code
 * path producing a message, not two that can disagree.
 *
 * `router.refresh()` re-runs the server render and leaves client state alone,
 * so the queue beside this keeps its scroll position, its view and its cursor.
 */
export function ThreadLive({ conversationId }: { conversationId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let queued: ReturnType<typeof setTimeout> | null = null

    // A reply writes a message and the trigger touches the conversation, so
    // changes arrive in pairs. One refresh is enough.
    const settle = () => {
      if (queued) clearTimeout(queued)
      queued = setTimeout(() => router.refresh(), 250)
    }

    const channel = supabase
      .channel(`desk-thread-${conversationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'support_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, settle)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'support_conversations',
        filter: `id=eq.${conversationId}`,
      }, settle)
      .subscribe()

    // Realtime drops while a tab sleeps, so catch up when it wakes.
    const onVisible = () => { if (document.visibilityState === 'visible') router.refresh() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (queued) clearTimeout(queued)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [conversationId, router])

  return null
}
