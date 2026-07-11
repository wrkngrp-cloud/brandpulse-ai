'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Loader2, ChevronDown } from 'lucide-react'
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
  'Is our brand getting stronger or weaker?',
  'What are people saying about us on X?',
  'What is our BHI score and what is driving it?',
  'Where should we focus to improve sentiment?',
]

export function AiCommand() {
  const [open, setOpen]               = useState(false)
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [conversationId, setConvId]   = useState<string | null>(null)
  const bottomRef                     = useRef<HTMLDivElement>(null)
  const textareaRef                   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) textareaRef.current?.focus()
  }, [open])

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
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          data-tour="ask-ai"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Open BrandGauge"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[360px] sm:w-[420px] h-[540px] rounded-2xl border bg-background shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-semibold">BrandGauge</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setOpen(false); setMessages([]); setConvId(null) }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground text-center pt-4">
                  Ask anything about your brand health, sentiment, or performance.
                </p>
                <div className="space-y-2">
                  {STARTERS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg border hover:bg-muted transition-colors text-muted-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col gap-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Bubble */}
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-foreground text-background rounded-br-sm'
                    : 'bg-muted rounded-bl-sm'
                }`}>
                  {m.content}
                </div>

                {/* Assistant metadata */}
                {m.role === 'assistant' && (
                  <div className="max-w-[85%] space-y-1.5">
                    {/* Confidence + sources */}
                    {(m.confidence || (m.sources && m.sources.length > 0)) && (
                      <div className="flex flex-wrap gap-1">
                        {m.confidence && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${CONFIDENCE_CLASS[m.confidence] ?? CONFIDENCE_CLASS.Low}`}>
                            {m.confidence} confidence
                          </span>
                        )}
                        {m.sources?.map((s, si) => (
                          <Badge key={si} variant="outline" className="text-[10px] font-normal px-2 py-0.5 h-auto" title={s.detail}>
                            {s.label}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Collection recommendation */}
                    {m.collectionRecommendation && (
                      <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                        <span className="font-medium">To get a better answer:</span> {m.collectionRecommendation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t px-3 py-2 shrink-0 flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about your brand..."
              className="min-h-[36px] max-h-[120px] resize-none text-sm border-0 focus-visible:ring-0 p-0 pt-1 bg-transparent"
              rows={1}
              disabled={loading}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0 mb-0.5"
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
