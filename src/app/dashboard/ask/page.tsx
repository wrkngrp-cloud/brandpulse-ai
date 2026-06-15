'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Send, Loader2, Sparkles, Plus, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { V2Tools } from './v2-tools'

// ── Types ────────────────────────────────────────────────────────────────────

interface Source {
  label: string
  detail: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  confidence?: 'High' | 'Medium' | 'Low'
  collectionRecommendation?: string | null
}

interface ConversationSummary {
  id: string
  title: string
  preview: string | null
  updatedAt: string
  messageCount: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFIDENCE_CLASS: Record<string, string> = {
  High:   'bg-green-50 text-green-700 border-green-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low:    'bg-muted text-muted-foreground border-border',
}

const STARTERS = [
  'Is our brand getting stronger or weaker right now?',
  'What is our Brand Health Index and what is driving it?',
  'What are people saying about us on Instagram?',
  'Where should we focus to improve our sentiment score?',
  'Which emotions are showing up most in recent mentions?',
  'What data are we missing that would improve the BHI?',
]

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Page ─────────────────────────────────────────────────────────────────────

function AskPageContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const cid          = searchParams.get('cid')
  const initialQ     = searchParams.get('q') ?? ''

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState(initialQ)
  const [loading,       setLoading]       = useState(false)
  const [convLoading,   setConvLoading]   = useState(false)
  const [histLoading,   setHistLoading]   = useState(false)
  const [conversationId, setConvId]       = useState<string | null>(cid)
  const [userEmail,     setUserEmail]     = useState('')
  const bottomRef  = useRef<HTMLDivElement>(null)
  const textRef    = useRef<HTMLTextAreaElement>(null)

  // Fetch user email for V2Tools
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email)
    })
  }, [])

  // Auto-send when navigated here with ?q=
  const autoSentRef = useRef(false)
  useEffect(() => {
    if (initialQ && !autoSentRef.current) {
      autoSentRef.current = true
      send(initialQ)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load conversation list
  const loadList = useCallback(async () => {
    setConvLoading(true)
    try {
      const res = await fetch('/api/ai/conversations')
      if (res.ok) {
        const data = await res.json() as { conversations: ConversationSummary[] }
        setConversations(data.conversations)
      }
    } finally {
      setConvLoading(false)
    }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  // Load full messages when a conversation is selected
  useEffect(() => {
    if (!cid) { setMessages([]); setConvId(null); return }
    if (cid === conversationId && messages.length > 0) return

    setHistLoading(true)
    setConvId(cid)
    setMessages([])

    fetch(`/api/ai/conversations/${cid}`)
      .then(r => r.json() as Promise<{ messages: Array<{ role: string; content: string }> }>)
      .then(data => {
        const msgs: Message[] = (data.messages ?? []).map(m => ({
          role:    m.role as 'user' | 'assistant',
          content: m.content,
        }))
        setMessages(msgs)
      })
      .catch(() => setMessages([]))
      .finally(() => setHistLoading(false))
  }, [cid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(question: string) {
    const q = question.trim()
    if (!q || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, conversationId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setMessages(prev => [...prev, { role: 'assistant', content: err.error ?? 'Something went wrong. Please try again.' }])
        return
      }

      const data = await res.json() as {
        answer: string
        sources: Source[]
        confidence: 'High' | 'Medium' | 'Low'
        collectionRecommendation: string | null
        conversationId: string
      }

      // If this is a new conversation, update URL without navigation
      if (!conversationId && data.conversationId) {
        setConvId(data.conversationId)
        router.replace(`/dashboard/ask?cid=${data.conversationId}`, { scroll: false })
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        confidence: data.confidence,
        collectionRecommendation: data.collectionRecommendation,
      }])

      // Refresh sidebar list to show new/updated entry
      loadList()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Check your connection and try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function newChat() {
    setMessages([])
    setConvId(null)
    setInput('')
    router.replace('/dashboard/ask', { scroll: false })
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const activeConvTitle = conversationId
    ? conversations.find(c => c.id === conversationId)?.title
    : null

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-0 -m-6">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r shrink-0 bg-background">
        <div className="p-3 border-b shrink-0">
          <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={newChat}>
            <Plus className="h-3.5 w-3.5" />
            New chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {convLoading && messages.length === 0 && (
            <p className="text-[11px] text-muted-foreground px-2 py-3">Loading history...</p>
          )}
          {conversations.length === 0 && !convLoading && (
            <p className="text-[11px] text-muted-foreground px-2 py-3">No past conversations yet.</p>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => {
                setMessages([])
                setConvId(conv.id)
                router.replace(`/dashboard/ask?cid=${conv.id}`, { scroll: false })
              }}
              className={cn(
                'w-full text-left rounded-lg px-2.5 py-2 transition-colors group',
                conv.id === conversationId
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <div className="flex items-start gap-1.5">
                <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 opacity-50" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium leading-tight line-clamp-2 text-foreground/80">
                    {conv.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(conv.updatedAt)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex flex-col flex-1 min-w-0 p-6">
        {/* Header */}
        <div className="shrink-0 pb-4 border-b mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {activeConvTitle ? (
                <span className="text-lg font-medium line-clamp-1">{activeConvTitle}</span>
              ) : 'Ask AI'}
            </h1>
          </div>
          {!activeConvTitle && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Ask anything about your brand health, sentiment, or performance — answers are grounded in your live data.
            </p>
          )}
        </div>

        {/* V2 AI Power Tools */}
        <V2Tools userEmail={userEmail} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {histLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading conversation...
            </div>
          )}

          {messages.length === 0 && !histLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div className="space-y-1">
                <p className="text-sm font-medium">What do you want to know about your brand?</p>
                <p className="text-xs text-muted-foreground">Every answer cites its source and states its confidence.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-sm px-4 py-3 rounded-xl border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="h-7 w-7 rounded-full bg-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-background" />
                </div>
              )}

              <div className={`flex flex-col gap-2 max-w-2xl ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-foreground text-background rounded-br-sm'
                    : 'bg-muted rounded-bl-sm'
                }`}>
                  {m.content}
                </div>

                {m.role === 'assistant' && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.confidence && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${CONFIDENCE_CLASS[m.confidence] ?? CONFIDENCE_CLASS.Low}`}>
                        {m.confidence} confidence
                      </span>
                    )}
                    {m.sources?.map((s, si) => (
                      <Badge key={si} variant="outline" className="text-xs font-normal" title={s.detail}>
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                )}

                {m.role === 'assistant' && m.collectionRecommendation && (
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 leading-relaxed max-w-2xl">
                    <span className="font-medium">To get a better answer: </span>
                    {m.collectionRecommendation}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="h-7 w-7 rounded-full bg-foreground flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-background" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 pt-4 border-t mt-4">
          <div className="flex items-end gap-3 max-w-3xl">
            <Textarea
              ref={textRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about your brand health, sentiment, or performance..."
              className="min-h-[44px] max-h-[160px] resize-none text-sm"
              rows={1}
              disabled={loading}
            />
            <Button
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Enter to send · Shift+Enter for new line · Answers grounded in your brand data
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AskPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100vh-7rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <AskPageContent />
    </Suspense>
  )
}
