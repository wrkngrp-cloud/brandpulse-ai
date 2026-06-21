'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Check, ArrowRight, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Brand {
  id:         string
  name:       string
  category:   string | null
  logo_url:   string | null
  created_at: string
}

interface Props {
  brands:         Brand[]
  activeBrandId:  string | null
  plan:           string
  brandLimit:     number
}

export function BrandsClient({ brands: initial, activeBrandId: initialActive, plan, brandLimit }: Props) {
  const router = useRouter()
  const [brands, setBrands]         = useState(initial)
  const [activeBrandId, setActive]  = useState(initialActive ?? initial[0]?.id ?? null)
  const [newName, setNewName]       = useState('')
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editName, setEditName]     = useState('')
  const [pending, startTransition]  = useTransition()

  const atLimit = brandLimit !== -1 && brands.length >= brandLimit

  async function switchBrand(brandId: string) {
    const res = await fetch('/api/brand/switch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ brandId }),
    })
    if (res.ok) {
      setActive(brandId)
      toast.success('Switched brand')
      router.refresh()
    }
  }

  async function addBrand() {
    if (!newName.trim()) return
    const res = await fetch('/api/brands', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (data.upgrade) {
        toast.error(data.error, { description: 'Upgrade your plan to add more brands.' })
      } else {
        toast.error(data.error ?? 'Failed to add brand')
      }
      return
    }
    setBrands(b => [...b, data])
    setNewName('')
    toast.success(`${data.name} added`)
    // Auto-switch to new brand
    await switchBrand(data.id)
  }

  async function renameBrand() {
    if (!editingId || !editName.trim()) return
    const res = await fetch(`/api/brands/${editingId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: editName.trim() }),
    })
    if (!res.ok) { toast.error('Failed to rename'); return }
    setBrands(b => b.map(x => x.id === editingId ? { ...x, name: editName.trim() } : x))
    setEditingId(null)
    toast.success('Brand renamed')
  }

  async function deleteBrand(id: string, name: string) {
    if (!confirm(`Delete "${name}"? All data for this brand will be permanently removed.`)) return
    const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to delete'); return }
    const remaining = brands.filter(b => b.id !== id)
    setBrands(remaining)
    if (activeBrandId === id && remaining.length) {
      await switchBrand(remaining[0].id)
    }
    toast.success(`${name} deleted`)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="eyebrow mb-1">Settings</p>
        <h1 className="h-display text-[26px] leading-none">Brands</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground/70">
          Manage the brands in your workspace. Your {plan} plan supports{' '}
          {brandLimit === -1 ? 'unlimited brands' : `up to ${brandLimit} brand${brandLimit === 1 ? '' : 's'}`}.
        </p>
      </div>

      {/* Brand list */}
      <div className="rounded-2xl border bg-card divide-y divide-border/50 overflow-hidden">
        {brands.map(brand => (
          <div key={brand.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20">
            {/* Logo / initials */}
            <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden">
              {brand.logo_url
                ? <img src={brand.logo_url} alt="" className="h-full w-full object-contain" />
                : <Building2 className="h-4 w-4 text-muted-foreground/50" />}
            </div>

            {/* Name + category */}
            <div className="flex-1 min-w-0">
              {editingId === brand.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameBrand(); if (e.key === 'Escape') setEditingId(null) }}
                    className="h-7 text-sm max-w-[200px]"
                  />
                  <Button size="sm" className="h-7 px-2" onClick={renameBrand}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-[14px] truncate">{brand.name}</span>
                  {activeBrandId === brand.id && (
                    <Badge variant="secondary" className="text-[11px] px-1.5 py-0.5 shrink-0">Active</Badge>
                  )}
                </div>
              )}
              {brand.category && (
                <p className="text-[12px] text-muted-foreground truncate">{brand.category}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {activeBrandId !== brand.id && (
                <Button
                  variant="ghost" size="sm" className="h-7 px-2 text-[12px]"
                  onClick={() => switchBrand(brand.id)}
                >
                  Switch <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => { setEditingId(brand.id); setEditName(brand.name) }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
                onClick={() => deleteBrand(brand.id, brand.name)}
                disabled={brands.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add brand */}
      {atLimit ? (
        <div className="rounded-xl border border-dashed p-5 text-center">
          <p className="text-[13px] text-muted-foreground">
            You've reached the brand limit for your {plan} plan.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = '/dashboard/settings/billing'}>
            Upgrade plan
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addBrand() }}
            placeholder="New brand name"
            className="max-w-xs"
          />
          <Button onClick={addBrand} disabled={!newName.trim() || pending} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add brand
          </Button>
        </div>
      )}
    </div>
  )
}
