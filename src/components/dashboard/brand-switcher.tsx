'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ChevronsUpDown, Building2, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface BrandOption {
  id:       string
  name:     string
  category: string | null
  logo_url: string | null
}

interface Props {
  brands:        BrandOption[]
  activeBrandId: string | null
}

export function BrandSwitcher({ brands, activeBrandId }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [currentId, setCurrentId] = useState(activeBrandId ?? brands[0]?.id ?? null)

  const current = brands.find(b => b.id === currentId) ?? brands[0]

  async function switchBrand(brandId: string) {
    if (brandId === currentId) return
    try {
      const res = await fetch('/api/brand/switch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ brandId }),
      })
      if (!res.ok) throw new Error()
      setCurrentId(brandId)
      startTransition(() => router.refresh())
    } catch {
      toast.error('Could not switch brand')
    }
  }

  if (brands.length <= 1) {
    // Single brand: just show the name, no dropdown needed
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40">
        <BrandAvatar brand={current} size="sm" />
        <span className="text-[13px] font-medium truncate max-w-[120px]">{current?.name ?? 'Brand'}</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors w-full text-left outline-none',
        pending && 'opacity-60'
      )}>
        <BrandAvatar brand={current} size="sm" />
        <span className="text-[13px] font-medium truncate flex-1 max-w-[110px]">{current?.name ?? 'Brand'}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {brands.map(brand => (
          <DropdownMenuItem
            key={brand.id}
            onClick={() => switchBrand(brand.id)}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <BrandAvatar brand={brand} size="xs" />
            <span className="flex-1 text-[13px] truncate">{brand.name}</span>
            {brand.id === currentId && <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.location.href = '/dashboard/settings/brands'} className="flex items-center gap-2.5 cursor-pointer">
          <div className="h-5 w-5 rounded-md bg-muted flex items-center justify-center">
            <Plus className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-[13px]">Manage brands</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BrandAvatar({ brand, size }: { brand: BrandOption | undefined; size: 'xs' | 'sm' }) {
  const dim = size === 'xs' ? 'h-5 w-5' : 'h-6 w-6'
  const iconDim = size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  return (
    <div className={cn(dim, 'rounded-md bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/30')}>
      {brand?.logo_url
        ? <img src={brand.logo_url} alt="" className="h-full w-full object-contain" />
        : <Building2 className={cn(iconDim, 'text-muted-foreground/60')} />}
    </div>
  )
}
