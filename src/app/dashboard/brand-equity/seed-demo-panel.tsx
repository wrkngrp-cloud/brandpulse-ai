'use client'

import { useState } from 'react'
import { Database, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SeedDemoPanel() {
  const [perceptionLoading, setPerceptionLoading] = useState(false)
  const [npsLoading,        setNpsLoading]        = useState(false)

  async function seedPerception() {
    setPerceptionLoading(true)
    try {
      const res  = await fetch('/api/demo/seed-perception', { method: 'POST' })
      const data = await res.json() as { success?: boolean; inserted?: number; error?: string }
      if (!res.ok || !data.success) {
        alert(`Error: ${data.error ?? 'Unknown error'}`)
      } else {
        alert(`Done! Inserted ${data.inserted} perception audit responses. Refresh the page to see the radar populate.`)
      }
    } catch (err) {
      alert(`Network error: ${String(err)}`)
    } finally {
      setPerceptionLoading(false)
    }
  }

  async function seedNps() {
    setNpsLoading(true)
    try {
      const res  = await fetch('/api/demo/seed-nps', { method: 'POST' })
      const data = await res.json() as { success?: boolean; inserted?: number; error?: string }
      if (!res.ok || !data.success) {
        alert(`Error: ${data.error ?? 'Unknown error'}`)
      } else {
        alert(`Done! Inserted ${data.inserted} NPS + awareness responses. Refresh the page to see scores update.`)
      }
    } catch (err) {
      alert(`Network error: ${String(err)}`)
    } finally {
      setNpsLoading(false)
    }
  }

  return (
    <div className="border border-dashed border-amber-400/60 rounded-xl p-4 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Developer Tools</p>
        <span className="text-[10px] bg-amber-200/80 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded px-1.5 py-0.5 font-mono">DEV ONLY</span>
      </div>
      <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
        Seed demo data into the database to test charts and scores. These buttons are hidden in production.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={seedPerception}
          disabled={perceptionLoading}
          className="border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          {perceptionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Seed Perception Data
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={seedNps}
          disabled={npsLoading}
          className="border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          {npsLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Seed NPS Data
        </Button>
      </div>
    </div>
  )
}
