'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2 } from 'lucide-react'

export interface SurveyQuestion {
  id: string
  type: 'single_choice' | 'nps'
  text: string
  required: boolean
  options?: string[]
}

interface Props {
  surveyId: string
  brandName: string
  questions: SurveyQuestion[]
  source: string
}

export function SurveyForm({ surveyId, brandName, questions, source }: Props) {
  const startedAt = useRef(Date.now())
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const question = questions[step]
  const isLast = step === questions.length - 1
  const hasAnswer = question ? answers[question.id] !== undefined : false

  async function submit(finalAnswers: Record<string, string | number>) {
    setSubmitting(true)
    await fetch(`/api/survey/${surveyId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: finalAnswers, started_at: startedAt.current, source }),
    })
    setDone(true)
    setSubmitting(false)
  }

  function selectChoice(questionId: string, value: string) {
    const newAnswers = { ...answers, [questionId]: value }
    setAnswers(newAnswers)
    if (isLast) {
      submit(newAnswers)
    } else {
      setStep(s => s + 1)
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-md text-center space-y-4 py-16">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        <h2 className="text-xl font-semibold">Thank you!</h2>
        <p className="text-muted-foreground text-sm">
          Your feedback helps {brandName} improve.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Brand */}
      <p className="text-center text-xs font-semibold tracking-widest uppercase text-muted-foreground">
        {brandName}
      </p>

      {/* Progress */}
      <div className="flex gap-1.5">
        {questions.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              i <= step ? 'bg-foreground' : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Question */}
      <div className="space-y-5">
        <h2 className="text-lg font-semibold leading-snug">{question.text}</h2>

        {question.type === 'single_choice' && question.options && (
          <div className="space-y-2">
            {question.options.map(option => (
              <button
                key={option}
                onClick={() => selectChoice(question.id, option)}
                disabled={submitting}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors',
                  answers[question.id] === option
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background hover:bg-muted'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {question.type === 'nps' && (
          <div className="space-y-3">
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setAnswers(a => ({ ...a, [question.id]: i }))}
                  className={cn(
                    'aspect-square rounded-md text-sm font-medium border transition-colors',
                    answers[question.id] === i
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background hover:bg-muted'
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Not likely</span>
              <span>Very likely</span>
            </div>
          </div>
        )}
      </div>

      {/* Submit — only shown for NPS (single_choice auto-advances) */}
      {question.type === 'nps' && (
        <Button
          onClick={() => submit(answers)}
          disabled={!hasAnswer || submitting}
          className="w-full"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
        </Button>
      )}
    </div>
  )
}
