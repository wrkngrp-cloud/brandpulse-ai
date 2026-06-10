'use client'

import { useState } from 'react'
import { SovWidget, type SovData } from '@/components/dashboard/sov-widget'
import { toast } from 'sonner'

export function SovWidgetClient({
  sov,
  competitors: initialCompetitors,
}: {
  sov: SovData
  competitors: { id: string; name: string }[]
}) {
  const [competitors, setCompetitors] = useState(initialCompetitors)

  async function onAddCompetitor(name: string) {
    const res = await fetch('/api/brand/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error('Failed')
    const added = await res.json() as { id: string; name: string }
    setCompetitors(c => [...c, added])
    toast.success(`Tracking ${name}`)
  }

  async function onRemoveCompetitor(id: string) {
    const res = await fetch('/api/brand/competitors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) { toast.error('Failed to remove'); return }
    setCompetitors(c => c.filter(x => x.id !== id))
  }

  return (
    <SovWidget
      sov={sov}
      competitors={competitors}
      onAddCompetitor={onAddCompetitor}
      onRemoveCompetitor={onRemoveCompetitor}
    />
  )
}
