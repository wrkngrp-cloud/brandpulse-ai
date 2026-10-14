'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageQuoteIcon, XIcon, SendIcon, ImageIcon, FileIcon } from '@/components/brand/icon'
import { Working } from '@/components/brand/working'
import { cn } from '@/lib/utils'

/**
 * The chat.
 *
 * One component, three places: the product, the marketing site, and every free
 * public tool. It behaves the same in all of them and only the `source` it
 * reports changes, which is what keeps the stranger queue separable from the
 * paying one without maintaining two widgets.
 *
 * It opens nothing on page load. A thread is created when somebody actually
 * opens the panel, so a visitor who never clicks leaves no row behind.
 *
 * Presence is honest. When somebody who can reply has been seen in the last
 * five minutes it says so. When nobody has, it says when we will reply and
 * asks for an address instead of implying that a person is watching.
 */

type Source = 'app' | 'site' | 'scoreboard' | 'tool'

interface Message {
  id: string
  author: 'customer' | 'staff' | 'system'
  authorName: string | null
  body: string
  attachments: { name: string; url: string | null; type: string }[]
  createdAt: string
}

interface Thread {
  id: string
  status: string
  email: string | null
  name: string | null
  messages: Message[]
  staffOnline: boolean
}

interface PendingFile {
  path: string; name: string; type: string; size: number; signature: string
}

const POLL_MS = 5000

export function ChatWidget({ source = 'site', replyPromise = 'within 4 working hours' }: {
  source?: Source
  /** What we say when nobody is on. Keep it to a promise we keep. */
  replyPromise?: string
}) {
  const [open, setOpen]       = useState(false)
  const [thread, setThread]   = useState<Thread | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft]     = useState('')
  const [files, setFiles]     = useState<PendingFile[]>([])
  const [error, setError]     = useState<string | null>(null)
  const [emailAsked, setEmailAsked] = useState(false)

  const endRef   = useRef<HTMLDivElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/support/thread', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ source, pageUrl: window.location.pathname }),
      })
      if (!res.ok) throw new Error('thread')
      setThread(await res.json())
    } catch {
      setError('The chat is not reachable right now. Email hello@brandgauge.app and we will pick it up.')
    }
  }, [source])

  // Opening is what creates the thread, so nothing happens until somebody
  // clicks. Done in the handler rather than an effect: opening is an event,
  // not state to synchronise, and an effect that sets state on mount is the
  // cascading-render pattern the lint rule is there to catch.
  const openPanel = useCallback(() => {
    setOpen(true)
    if (thread) return
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [thread, load])

  // A stranger has no Realtime identity to subscribe with, so the panel polls
  // while it is open and stops the moment it closes.
  useEffect(() => {
    if (!open || !thread) return
    const timer = setInterval(() => { void load() }, POLL_MS)
    return () => clearInterval(timer)
  }, [open, thread, load])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [thread?.messages.length, open])

  const upload = async (file: File) => {
    setError(null)
    const body = new FormData()
    body.append('file', file)
    try {
      const res = await fetch('/api/support/attachment', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Could not attach that.'); return }
      setFiles(prev => [...prev, json as PendingFile])
    } catch {
      setError('Could not attach that.')
    }
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/support/message', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ body: text, attachments: files }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Could not send that.'); return }
      setDraft('')
      setFiles([])
      setThread(prev => (prev ? { ...prev, messages: json.messages } : prev))
      if (!thread?.email && !thread?.staffOnline) setEmailAsked(true)
    } catch {
      setError('Could not send that.')
    } finally {
      setSending(false)
    }
  }

  const identify = async (formData: FormData) => {
    const email = String(formData.get('email') ?? '')
    const name  = String(formData.get('name') ?? '')
    try {
      const res = await fetch('/api/support/identify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, name }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'That email did not save.'); return }
      setThread(prev => (prev ? { ...prev, email } : prev))
      setEmailAsked(false)
    } catch {
      setError('That email did not save.')
    }
  }

  const unanswered = (thread?.messages ?? []).filter(m => m.author === 'staff').length

  return (
    <>
      {/* Launcher. Flare fills the whole plane, and the type on it is ink,
          because paper on Flare fails contrast and ink passes. */}
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          className="bg-press fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-xl bg-flare px-4 py-3 text-on-hot"
          aria-label="Chat with us"
        >
          <MessageQuoteIcon className="size-5" />
          <span className="text-sm font-medium">Chat with us</span>
          {unanswered > 0 && (
            <span className="bg-num rounded-full bg-paper px-1.5 text-xs text-tx">{unanswered}</span>
          )}
        </button>
      )}

      {open && (
        <section
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col border border-line bg-paper sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-h-[min(36rem,85vh)] sm:w-96 sm:rounded-xl"
          aria-label="Support chat"
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-medium">BrandGauge support</p>
              <p className="mt-0.5 text-xs text-tx-3">
                {thread?.staffOnline
                  ? 'Someone is here now'
                  : `We reply ${replyPromise}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-press flex size-7 items-center justify-center rounded-md border border-line text-tx-2"
              aria-label="Close chat"
            >
              <XIcon className="size-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {loading && !thread && (
              <div className="space-y-2" aria-hidden>
                <div className="h-10 w-2/3 rounded-xl bg-shell" />
                <div className="ml-auto h-10 w-1/2 rounded-xl bg-shell" />
              </div>
            )}

            {thread && thread.messages.length === 0 && (
              <p className="text-sm text-tx-2">
                Tell us what you are trying to do and we will help. If something looks
                wrong, a screenshot usually saves a few messages.
              </p>
            )}

            {thread?.messages.map(message => (
              <ChatBubble key={message.id} message={message} />
            ))}

            <div ref={endRef} />
          </div>

          {emailAsked && !thread?.email && (
            <form action={identify} className="space-y-2 border-t border-line bg-shell px-4 py-3">
              <p className="text-xs text-tx-2">
                Nobody is on the chat right now. Leave your email and we will reply{' '}
                {replyPromise}.
              </p>
              <div className="flex gap-2">
                <input
                  name="email" type="email" required placeholder="you@company.com"
                  className="h-8 flex-1 rounded-md border border-line bg-paper px-2 text-sm"
                />
                <button type="submit" className="bg-press rounded-md border border-line px-2.5 text-xs">
                  Save
                </button>
              </div>
            </form>
          )}

          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2 border-t border-line px-4 py-2">
              {files.map(file => (
                <li key={file.path} className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs">
                  <FileIcon className="size-3" />
                  <span className="max-w-32 truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(prev => prev.filter(f => f.path !== file.path))}
                    aria-label={`Remove ${file.name}`}
                    className="text-tx-3"
                  >
                    <XIcon className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="border-t border-line px-4 py-2 text-xs text-neg" role="alert">{error}</p>
          )}

          <footer className="flex items-end gap-2 border-t border-line px-3 py-3">
            <input
              ref={fileRef} type="file" className="sr-only"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={event => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
                event.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="bg-press flex size-9 shrink-0 items-center justify-center rounded-md border border-line text-tx-2"
              aria-label="Attach a file"
            >
              <ImageIcon className="size-4" />
            </button>

            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
              rows={1}
              placeholder="Type a message"
              className="max-h-28 min-h-9 flex-1 resize-none rounded-md border border-line bg-paper px-3 py-2 text-sm"
            />

            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !draft.trim()}
              className={cn(
                'bg-press flex size-9 shrink-0 items-center justify-center rounded-md',
                draft.trim() ? 'bg-flare text-on-hot' : 'border border-line text-tx-3',
              )}
              aria-label="Send"
            >
              {sending ? <Working className="size-4" /> : <SendIcon className="size-4" />}
            </button>
          </footer>
        </section>
      )}
    </>
  )
}

function ChatBubble({ message }: { message: Message }) {
  const mine = message.author === 'customer'

  if (message.author === 'system') {
    return <p className="text-center text-xs text-tx-3">{message.body}</p>
  }

  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {!mine && message.authorName && (
        <span className="px-1 text-xs text-tx-3">{message.authorName}</span>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap',
          mine ? 'bg-shell text-tx' : 'border border-line bg-card text-tx',
        )}
      >
        {message.body}
        {message.attachments.length > 0 && (
          <ul className="mt-2 space-y-1">
            {message.attachments.map(file => (
              <li key={file.name} className="text-xs">
                {file.url ? (
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {file.name}
                  </a>
                ) : (
                  <span className="text-tx-3">{file.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <time className="bg-num px-1 text-[0.65rem] text-tx-3" dateTime={message.createdAt}>
        {new Date(message.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
      </time>
    </div>
  )
}
