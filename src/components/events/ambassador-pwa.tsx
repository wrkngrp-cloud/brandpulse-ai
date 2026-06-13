'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast }    from 'sonner'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Users, Target, Handshake, UserCheck, Gift, FlaskConical,
  Trophy, Camera, ClipboardList, Trophy as Leaderboard, Loader2,
  WifiOff, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QueuedInteraction {
  clientUuid:       string
  interactionType:  string
  leadName?:        string
  leadPhone?:       string
  leadInterest?:    string
  occurredAt:       string
}

interface LeaderboardEntry {
  id:      string
  name:    string
  total:   number
  leads:   number
  engaged: number
}

interface Props {
  sessionToken:  string
  ambassadorName: string
  eventName:     string
  brandName:     string
  eventCity:     string
}

const QUEUE_KEY = (token: string) => `bp_queue_${token}`

const BUTTONS = [
  { type: 'engaged',           label: 'Engaged',          icon: Users,       color: 'bg-blue-500'    },
  { type: 'new_lead',          label: 'New Lead',          icon: Target,      color: 'bg-green-500'   },
  { type: 'new_customer',      label: 'New Customer',      icon: Handshake,   color: 'bg-emerald-600' },
  { type: 'existing_customer', label: 'Existing Customer', icon: UserCheck,   color: 'bg-purple-500'  },
  { type: 'merch',             label: 'Merch Given',       icon: Gift,        color: 'bg-orange-400'  },
  { type: 'sample',            label: 'Sample Given',      icon: FlaskConical,color: 'bg-yellow-500'  },
  { type: 'prize',             label: 'Prize Won',         icon: Trophy,      color: 'bg-pink-500'    },
  { type: 'photo',             label: 'Photo Moment',      icon: Camera,      color: 'bg-violet-500'  },
] as const

const SURVEY_QUESTIONS = [
  {
    key: 'brand_awareness',
    question: 'Had they heard of the brand before today?',
    options: [
      { value: 'definitely',  label: 'Yes, definitely' },
      { value: 'heard_of',    label: 'Heard of it' },
      { value: 'first_time',  label: 'First time hearing' },
    ],
  },
  {
    key: 'event_discovery',
    question: 'How did they hear about today\'s event?',
    options: [
      { value: 'social',    label: 'Social media' },
      { value: 'friend',    label: 'Friend / Family' },
      { value: 'ooh',       label: 'Billboard / OOH' },
      { value: 'radio_tv',  label: 'Radio / TV' },
      { value: 'walked_by', label: 'Walked past' },
    ],
  },
  {
    key: 'experience_rating',
    question: 'Rate their experience at our stand',
    options: [1,2,3,4,5].map(n => ({ value: String(n), label: '⭐'.repeat(n) })),
  },
  {
    key: 'purchase_interest',
    question: 'Are they interested in the product / service?',
    options: [
      { value: 'very',     label: 'Very interested' },
      { value: 'somewhat', label: 'Somewhat' },
      { value: 'not_really', label: 'Not really' },
    ],
  },
]

type Screen = 'main' | 'survey' | 'leaderboard'

export function AmbassadorPwa({ sessionToken, ambassadorName, eventName, brandName, eventCity }: Props) {
  const [screen,      setScreen    ] = useState<Screen>('main')
  const [pending,     setPending   ] = useState(false)
  const [queue,       setQueue     ] = useState<QueuedInteraction[]>([])
  const [lastTap,     setLastTap   ] = useState<string | null>(null)
  const [isOnline,    setIsOnline  ] = useState(true)
  const [counts,      setCounts    ] = useState<Record<string, number>>({})

  // Lead capture sheet
  const [leadOpen,    setLeadOpen  ] = useState(false)
  const [leadName,    setLeadName  ] = useState('')
  const [leadPhone,   setLeadPhone ] = useState('')
  const [leadInterest,setLeadInterest] = useState('')

  // Survey state
  const [surveyAnswers,  setSurveyAnswers ] = useState<Record<string, string>>({})
  const [surveyQ,        setSurveyQ       ] = useState(0)
  const [surveyPending,  setSurveyPending ] = useState(false)
  const [surveyDone,     setSurveyDone    ] = useState(false)

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myId,        setMyId        ] = useState<string | null>(null)
  const [lbLoading,   setLbLoading  ] = useState(false)

  // Load queue from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(QUEUE_KEY(sessionToken))
    if (stored) setQueue(JSON.parse(stored))
    setIsOnline(navigator.onLine)

    const online  = () => setIsOnline(true)
    const offline = () => setIsOnline(false)
    window.addEventListener('online',  online)
    window.addEventListener('offline', offline)
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline) }
  }, [sessionToken])

  // Flush queue whenever we come back online
  useEffect(() => {
    if (isOnline && queue.length > 0) flushQueue()
  }, [isOnline])

  function saveQueue(q: QueuedInteraction[]) {
    setQueue(q)
    localStorage.setItem(QUEUE_KEY(sessionToken), JSON.stringify(q))
  }

  async function syncInteraction(ia: QueuedInteraction): Promise<boolean> {
    try {
      const res = await fetch('/api/event/interaction', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sessionToken:  sessionToken,
          interactionType: ia.interactionType,
          leadName:      ia.leadName,
          leadPhone:     ia.leadPhone,
          leadInterest:  ia.leadInterest,
          clientUuid:    ia.clientUuid,
          occurredAt:    ia.occurredAt,
        }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  const flushQueue = useCallback(async () => {
    const current = JSON.parse(localStorage.getItem(QUEUE_KEY(sessionToken)) ?? '[]') as QueuedInteraction[]
    if (!current.length) return
    const remaining: QueuedInteraction[] = []
    for (const ia of current) {
      const ok = await syncInteraction(ia)
      if (!ok) remaining.push(ia)
    }
    saveQueue(remaining)
  }, [sessionToken])

  async function logInteraction(type: string, lead?: { name: string; phone: string; interest: string }) {
    const ia: QueuedInteraction = {
      clientUuid:      crypto.randomUUID(),
      interactionType: type,
      leadName:        lead?.name     || undefined,
      leadPhone:       lead?.phone    || undefined,
      leadInterest:    lead?.interest || undefined,
      occurredAt:      new Date().toISOString(),
    }

    // Optimistic UI
    setCounts(prev => ({ ...prev, [type]: (prev[type] ?? 0) + 1 }))
    setLastTap(type)
    setTimeout(() => setLastTap(null), 800)

    // Try to sync immediately
    const ok = await syncInteraction(ia)
    if (!ok) {
      // Queue for later
      const updated = [...queue, ia]
      saveQueue(updated)
    }
  }

  async function handleTap(type: string) {
    if (type === 'new_lead') {
      setLeadName(''); setLeadPhone(''); setLeadInterest('')
      setLeadOpen(true)
      return
    }
    setPending(true)
    await logInteraction(type)
    setPending(false)
  }

  async function handleLeadSubmit() {
    if (!leadName.trim()) { toast.error('Name is required'); return }
    setPending(true)
    await logInteraction('new_lead', { name: leadName.trim(), phone: leadPhone.trim(), interest: leadInterest.trim() })
    setLeadOpen(false)
    setPending(false)
  }

  async function handleSurveyNext() {
    const currentQ = SURVEY_QUESTIONS[surveyQ]
    if (!surveyAnswers[currentQ.key]) { toast.error('Please select an answer'); return }
    if (surveyQ < SURVEY_QUESTIONS.length - 1) {
      setSurveyQ(q => q + 1)
    } else {
      setSurveyPending(true)
      try {
        const res = await fetch('/api/event/intercept-survey', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ sessionToken, answers: surveyAnswers }),
        })
        if (res.ok) { setSurveyDone(true) }
        else        { toast.error('Failed to save survey. Try again.') }
      } catch {
        toast.error('You are offline. Survey not saved.')
      } finally {
        setSurveyPending(false)
      }
    }
  }

  async function loadLeaderboard() {
    setLbLoading(true)
    try {
      const res  = await fetch(`/api/event/leaderboard?token=${sessionToken}`)
      const data = await res.json()
      setLeaderboard(data.leaderboard ?? [])
      setMyId(data.myId ?? null)
    } catch {
      toast.error('Could not load leaderboard.')
    } finally {
      setLbLoading(false)
    }
  }

  useEffect(() => {
    if (screen === 'leaderboard') loadLeaderboard()
  }, [screen])

  const totalMine = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-foreground text-background px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-70">{brandName} · {eventCity}</p>
            <p className="font-semibold text-sm leading-tight">{eventName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-70">{ambassadorName}</p>
            <div className="flex items-center gap-1.5 justify-end">
              {!isOnline && <WifiOff className="h-3 w-3 text-red-400" />}
              {queue.length > 0 && (
                <span className="text-xs bg-yellow-400 text-black rounded-full px-1.5 font-medium">{queue.length} pending</span>
              )}
              <span className="text-sm font-bold tabular-nums">{totalMine}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="border-b flex">
        {([['main','Tap'], ['survey','Survey'], ['leaderboard','Team']] as [Screen, string][]).map(([s, label]) => (
          <button
            key={s}
            onClick={() => setScreen(s)}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              screen === s ? 'border-b-2 border-foreground' : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main tap screen */}
      {screen === 'main' && (
        <div className="flex-1 p-4 safe-bottom">
          <div className="grid grid-cols-2 gap-3">
            {BUTTONS.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => handleTap(type)}
                disabled={pending}
                className={cn(
                  'relative rounded-2xl p-5 flex flex-col items-center gap-3 transition-all active:scale-95 select-none',
                  'border-2',
                  lastTap === type ? 'border-foreground scale-95' : 'border-transparent',
                  'bg-card hover:bg-muted',
                )}
              >
                <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', color, 'bg-opacity-15')}>
                  <Icon className={cn('h-6 w-6', color.replace('bg-', 'text-'))} />
                </div>
                <span className="text-sm font-medium text-center leading-tight">{label}</span>
                {counts[type] ? (
                  <span className="absolute top-2 right-2 text-xs font-bold tabular-nums bg-foreground text-background rounded-full h-5 w-5 flex items-center justify-center">
                    {counts[type]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {queue.length > 0 && isOnline && (
            <button
              onClick={flushQueue}
              className="mt-4 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground py-2 border rounded-xl"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync {queue.length} pending interaction{queue.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* Survey screen */}
      {screen === 'survey' && (
        <div className="flex-1 p-6 flex flex-col safe-bottom">
          {surveyDone ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <ClipboardList className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="font-semibold">Survey submitted!</p>
                <p className="text-sm text-muted-foreground mt-1">Thanks for collecting this response.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSurveyDone(false)
                  setSurveyQ(0)
                  setSurveyAnswers({})
                }}
              >
                Start new survey
              </Button>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Question {surveyQ + 1} of {SURVEY_QUESTIONS.length}</p>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all"
                    style={{ width: `${((surveyQ + 1) / SURVEY_QUESTIONS.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <p className="text-base font-medium">{SURVEY_QUESTIONS[surveyQ].question}</p>
                <div className="space-y-2">
                  {SURVEY_QUESTIONS[surveyQ].options.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSurveyAnswers(prev => ({ ...prev, [SURVEY_QUESTIONS[surveyQ].key]: opt.value }))}
                      className={cn(
                        'w-full text-left p-4 rounded-xl border-2 text-sm font-medium transition-colors',
                        surveyAnswers[SURVEY_QUESTIONS[surveyQ].key] === opt.value
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={handleSurveyNext} disabled={surveyPending || !surveyAnswers[SURVEY_QUESTIONS[surveyQ].key]}>
                {surveyPending ? <Loader2 className="h-4 w-4 animate-spin" /> : surveyQ < SURVEY_QUESTIONS.length - 1 ? 'Next' : 'Submit survey'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard screen */}
      {screen === 'leaderboard' && (
        <div className="flex-1 p-4 safe-bottom space-y-3">
          {lbLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No data yet.</p>
          ) : (
            leaderboard.map((entry, rank) => (
              <div
                key={entry.id}
                className={cn(
                  'border rounded-xl p-4 flex items-center gap-3 bg-card',
                  entry.id === myId && 'border-foreground bg-foreground text-background',
                )}
              >
                <span className={cn('text-lg font-bold tabular-nums w-6 text-center', entry.id === myId ? 'text-background' : 'text-muted-foreground')}>
                  {rank + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {entry.name}{entry.id === myId ? ' (you)' : ''}
                  </p>
                  <p className={cn('text-xs', entry.id === myId ? 'text-background/70' : 'text-muted-foreground')}>
                    {entry.leads} leads · {entry.engaged} engaged
                  </p>
                </div>
                <span className="text-xl font-bold tabular-nums">{entry.total}</span>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={loadLeaderboard} disabled={lbLoading}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      )}

      {/* New Lead bottom sheet */}
      <Sheet open={leadOpen} onOpenChange={setLeadOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>New lead</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4 pb-safe">
            <div className="space-y-2">
              <Label htmlFor="lead-name">Full name *</Label>
              <Input id="lead-name" value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="Attendee's name" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Phone number *</Label>
              <Input id="lead-phone" type="tel" value={leadPhone} onChange={e => setLeadPhone(e.target.value)} placeholder="+234..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-interest">Interest / product</Label>
              <Input id="lead-interest" value={leadInterest} onChange={e => setLeadInterest(e.target.value)} placeholder="e.g. Savings account, Loan" />
            </div>
            <Button className="w-full" onClick={handleLeadSubmit} disabled={pending || !leadName.trim()}>
              {pending ? 'Saving…' : 'Log lead'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
