'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export const CATEGORIES = [
  'Fintech', 'FMCG', 'Telco', 'Fashion & Apparel', 'Healthcare',
  'Education', 'Entertainment & Media', 'Retail', 'Real Estate',
  'Logistics', 'Food & Beverage', 'Automotive', 'Other',
]

export const CULTURAL_SLIDERS = [
  { key: 'community_corporate' as const, left: 'Community', right: 'Corporate',
    hint: 'Do you lead with people and community, or with brand authority?' },
  { key: 'traditional_modern' as const, left: 'Traditional', right: 'Modern',
    hint: 'Deep roots in Nigerian/African heritage, or forward-looking?' },
  { key: 'religious_secular' as const, left: 'Religious', right: 'Secular',
    hint: 'Spiritual language and cues, or neutral on religion?' },
  { key: 'mass_premium' as const, left: 'Mass market', right: 'Premium',
    hint: 'Everyday affordability, or aspirational positioning?' },
  { key: 'local_global' as const, left: 'Local', right: 'Global',
    hint: 'Proudly Nigerian/African, or international appeal?' },
]

export function TagInput({ label, placeholder, values, onChange, hint }: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void; hint?: string
}) {
  const [input, setInput] = useState('')
  function add() {
    const t = input.trim()
    if (t && !values.includes(t)) onChange([...values, t])
    setInput('')
  }
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground -mt-1">{hint}</p>}
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} className="text-sm" />
        <Button type="button" variant="outline" size="icon" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map(v => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1 text-xs">
              {v}
              <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-destructive ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function CulturalSlider({ left, right, hint, value, onChange }: {
  left: string; right: string; hint: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium text-muted-foreground">
        <span>{left}</span><span>{right}</span>
      </div>
      <input type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))} className="w-full accent-primary" />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function SectionCard({ title, children, className }: {
  title: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('border rounded-xl p-5 space-y-4 bg-card', className)}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  )
}
