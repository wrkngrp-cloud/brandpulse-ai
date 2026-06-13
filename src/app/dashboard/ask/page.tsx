'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

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

export default function AskPage() {
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [conversationId, setConvId] = useState<string | null>(null)
  const bottomRef                   = useRef<HTMLDivElement>(null)
  const textareaRef                 = useRef<HTMLTextAreaElement>(null)

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
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: err.error ?? 'Something went wrong. Please try again.',
        }])
        return
      }

      const data = await res.json() as {
        answer: string
        sources: Source[]
        confidence: 'High' | 'Medium' | 'Low'
        collectionRecommendation: string | null
        conversationId: string
      }

      setConvId(data.conversationId)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        confidence: data.confidence,
        collectionRecommendation: data.collectionRecommendation,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Network error. Check your connection and try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="shrink-0 pb-4 border-b mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Ask AI</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ask anything about your brand health, sentiment, or performance — answers are grounded in your live data.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {messages.length === 0 && (
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

              {m.role === 'assistant' && (confidence => (
                <div className="flex flex-wrap gap-1.5">
                  {confidence && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${CONFIDENCE_CLASS[confidence] ?? CONFIDENCE_CLASS.Low}`}>
                      {confidence} confidence
                    </span>
                  )}
                  {m.sources?.map((s, si) => (
                    <Badge key={si} variant="outline" className="text-xs font-normal" title={s.detail}>
                      {s.label}
                    </Badge>
                  ))}
                </div>
              ))(m.confidence)}

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
            ref={textareaRef}
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
  )
}
