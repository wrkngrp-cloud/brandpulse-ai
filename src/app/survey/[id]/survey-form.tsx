'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, ChevronLeft } from 'lucide-react'

export interface SurveyQuestion {
  id:       string
  type:     'single_choice' | 'nps' | 'rating' | 'text'
  text:     string
  required: boolean
  options?: string[]
  scale?:   { min: number; max: number; minLabel: string; maxLabel: string }
}

interface Props {
  surveyId:  string
  brandName: string
  questions: SurveyQuestion[]
  source:    string
}

export function SurveyForm({ surveyId, brandName, questions, source }: Props) {
  const startedAt = useRef(Date.now())
  const [step,       setStep]       = useState(0)
  const [answers,    setAnswers]    = useState<Record<string, string | number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)

  const question = questions[step]
  const isLast   = step === questions.length - 1
  const hasAnswer = question ? answers[question.id] !== undefined : false
  const needsExplicit = question?.type !== 'single_choice'  // rating/nps/text need explicit Next

  async function submit(finalAnswers: Record<string, string | number>) {
    setSubmitting(true)
    await fetch(`/api/survey/${surveyId}/respond`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ answers: finalAnswers, started_at: startedAt.current, source }),
    })
    setDone(true)
    setSubmitting(false)
  }

  function advance(newAnswers: Record<string, string | number>) {
    if (isLast) {
      submit(newAnswers)
    } else {
      setStep(s => s + 1)
    }
  }

  function selectChoice(questionId: string, value: string) {
    const updated = { ...answers, [questionId]: value }
    setAnswers(updated)
    advance(updated)                   // single_choice auto-advances
  }

  function handleNext() {
    if (!hasAnswer && question?.required) return
    advance(answers)
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
    <div className="w-full max-w-md space-y-8 px-4 sm:px-0">
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
              i < step  ? 'bg-foreground'
            : i === step ? 'bg-foreground/60'
            : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Step counter */}
      <p className="text-xs text-muted-foreground text-right -mt-4">
        {step + 1} / {questions.length}
      </p>

      {/* Question */}
      <div className="space-y-5">
        <h2 className="text-lg font-semibold leading-snug">{question.text}</h2>

        {/* ── single_choice ───────────────────────────────────────────── */}
        {question.type === 'single_choice' && question.options && (
          <div className="space-y-2.5">
            {question.options.map(option => (
              <button
                key={option}
                onClick={() => selectChoice(question.id, option)}
                disabled={submitting}
                className={cn(
                  'w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-all active:scale-[0.98]',
                  answers[question.id] === option
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background hover:bg-muted hover:border-foreground/30'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {/* ── nps ─────────────────────────────────────────────────────── */}
        {question.type === 'nps' && (
          <div className="space-y-3">
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setAnswers(a => ({ ...a, [question.id]: i }))}
                  className={cn(
                    'w-10 h-10 rounded-lg text-sm font-semibold border transition-all active:scale-95',
                    answers[question.id] === i
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background hover:bg-muted hover:border-foreground/30'
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Not likely at all</span>
              <span>Extremely likely</span>
            </div>
          </div>
        )}

        {/* ── rating (1-5) ─────────────────────────────────────────────── */}
        {question.type === 'rating' && question.scale && (
          <div className="space-y-3">
            <div className="flex gap-2 justify-between">
              {Array.from(
                { length: question.scale.max - question.scale.min + 1 },
                (_, i) => i + question.scale!.min
              ).map(val => (
                <button
                  key={val}
                  onClick={() => setAnswers(a => ({ ...a, [question.id]: val }))}
                  className={cn(
                    'flex-1 py-3.5 rounded-xl border text-sm font-semibold transition-all active:scale-95',
                    answers[question.id] === val
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background hover:bg-muted hover:border-foreground/30'
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-0.5">
              <span>{question.scale.minLabel}</span>
              <span>{question.scale.maxLabel}</span>
            </div>
          </div>
        )}

        {/* ── text ──────────────────────────────────────────────────────── */}
        {question.type === 'text' && (
          <textarea
            value={(answers[question.id] as string) ?? ''}
            onChange={e => setAnswers(a => ({ ...a, [question.id]: e.target.value }))}
            placeholder="Type your answer here…"
            rows={4}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground/50"
          />
        )}
      </div>

      {/* Navigation row — back + next/submit */}
      <div className="flex items-center gap-3">
        {/* Back button */}
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={submitting}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        )}

        {/* Next / Submit — only for types that don't auto-advance */}
        {needsExplicit && (
          <button
            onClick={handleNext}
            disabled={(question.required && !hasAnswer) || submitting}
            className={cn(
              'ml-auto px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95',
              'bg-foreground text-background',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              : isLast ? 'Submit' : 'Next'}
          </button>
        )}

        {/* If single_choice and optional, show a Skip link */}
        {!needsExplicit && !question.required && (
          <button
            onClick={() => advance(answers)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
