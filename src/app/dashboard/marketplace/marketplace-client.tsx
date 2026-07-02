'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingBag, Plus, Star, Package, TrendingUp,
  TrendingDown, Minus, Loader2, X, RefreshCw,
  ExternalLink, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn, formatNGN } from '@/lib/utils'
import { toast } from 'sonner'
import { TourTrigger } from '@/components/tours/tour-trigger'

interface MarketplaceProduct {
  id:             string
  platform:       string
  product_name:   string
  sku:            string | null
  product_url:    string | null
  category:       string | null
  is_own_product: boolean
  latest_snapshot: {
    price:          number | null
    rating:         number | null
    review_count:   number | null
    shelf_position: number | null
    in_stock:       boolean | null
    scraped_at:     string | null
  }[] | null
}

const PLATFORM_COLOR: Record<string, string> = {
  jumia:  'bg-orange-100 text-orange-800 border-orange-200',
  konga:  'bg-red-100 text-red-800 border-red-200',
  amazon: 'bg-blue-100 text-blue-800 border-blue-200',
  other:  'bg-gray-100 text-gray-800 border-gray-200',
}

export function MarketplaceClient() {
  const [products, setProducts]     = useState<MarketplaceProduct[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [showSnap, setShowSnap]     = useState<string | null>(null)
  const [filter, setFilter]         = useState<'all' | 'own' | 'competitor'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const params = filter === 'own' ? '?own=true' : filter === 'competitor' ? '?own=false' : ''
    const res = await fetch(`/api/marketplace/products${params}`)
    if (res.ok) setProducts((await res.json()).products ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const ownProducts        = products.filter(p => p.is_own_product)
  const competitorProducts = products.filter(p => !p.is_own_product)

  const avgRating  = ownProducts.length
    ? ownProducts.reduce((s, p) => s + (p.latest_snapshot?.[0]?.rating ?? 0), 0) / ownProducts.length
    : null
  const totalReviews = ownProducts.reduce((s, p) => s + (p.latest_snapshot?.[0]?.review_count ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Marketplace Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track your products on Jumia, Konga, and other platforms
          </p>
        </div>
        <div className="flex gap-2">
          <TourTrigger module="marketplace" autoStart />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add product
          </Button>
        </div>
      </div>

      {/* KPI row */}
      {ownProducts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="marketplace-main">
          <MiniStat icon={<Package className="h-4 w-4" />}    label="Own products"    value={String(ownProducts.length)} />
          <MiniStat icon={<ShoppingBag className="h-4 w-4" />} label="Competitors"    value={String(competitorProducts.length)} />
          <MiniStat icon={<Star className="h-4 w-4" />}       label="Avg rating"      value={avgRating ? `${avgRating.toFixed(1)} ★` : '—'} />
          <MiniStat icon={<TrendingUp className="h-4 w-4" />} label="Total reviews"   value={totalReviews.toLocaleString()} />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'own', 'competitor'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full border text-xs font-medium capitalize transition-colors',
              filter === f ? 'bg-foreground text-background border-foreground' : 'hover:bg-muted border-border'
            )}
          >
            {f === 'own' ? 'My products' : f === 'competitor' ? 'Competitors' : 'All'}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <AddProductForm
          onSave={async (data) => {
            const res = await fetch('/api/marketplace/products', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
            })
            if (!res.ok) { toast.error('Failed to add product'); return }
            toast.success('Product added')
            setShowForm(false)
            load()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading && products.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="rounded-xl border border-dashed p-16 text-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No products tracked yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Add your brand's products and competitor listings to start tracking shelf position, price, and ratings.
          </p>
        </div>
      )}

      {/* Product grid */}
      <div className="space-y-3">
        {products.map(p => (
          <ProductRow
            key={p.id}
            product={p}
            showSnap={showSnap === p.id}
            onToggleSnap={() => setShowSnap(showSnap === p.id ? null : p.id)}
            onAddSnapshot={async (data) => {
              const res = await fetch('/api/marketplace/snapshots', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: p.id, ...data }),
              })
              if (!res.ok) { toast.error('Failed to save snapshot'); return }
              toast.success('Snapshot saved')
              setShowSnap(null)
              load()
            }}
          />
        ))}
      </div>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon} {label}</div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

function productSummary(product: MarketplaceProduct): string {
  const snap    = product.latest_snapshot?.[0]
  const cat     = product.category ?? 'Uncategorized'
  const plat    = product.platform.charAt(0).toUpperCase() + product.platform.slice(1)
  const reviews = snap?.review_count ? ` · ${snap.review_count.toLocaleString()} reviews` : ''
  const shelf   = snap?.shelf_position != null ? ` · shelf #${snap.shelf_position}` : ''
  if (product.is_own_product) {
    return `Your product in ${cat} on ${plat}${reviews}${shelf}`
  }
  return `Competitor tracking — ${cat} on ${plat}${reviews}${shelf}`
}

function ProductRow({
  product, showSnap, onToggleSnap, onAddSnapshot,
}: {
  product: MarketplaceProduct
  showSnap: boolean
  onToggleSnap: () => void
  onAddSnapshot: (d: Record<string, unknown>) => void
}) {
  const snap = product.latest_snapshot?.[0]

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {showSnap ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <button onClick={onToggleSnap} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{product.product_name}</span>
            <Badge variant="outline" className={cn('text-xs capitalize', PLATFORM_COLOR[product.platform] ?? '')}>
              {product.platform}
            </Badge>
            {!product.is_own_product && (
              <Badge variant="outline" className="text-xs text-purple-700 border-purple-200">Competitor</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{productSummary(product)}</p>
        </button>
        <div className="flex items-center gap-4 shrink-0 text-sm">
          {snap?.price    != null && <span className="font-semibold">{formatNGN(snap.price)}</span>}
          {snap?.rating   != null && <span className="text-yellow-500 font-medium">★ {snap.rating.toFixed(1)}</span>}
          {snap?.in_stock === false && <Badge variant="destructive" className="text-xs">Out of stock</Badge>}
          {snap?.shelf_position != null && <span className="text-muted-foreground text-xs">#{snap.shelf_position}</span>}
          {product.product_url && (
            <a href={product.product_url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      </div>

      {showSnap && (
        <div className="border-t px-4 py-4 bg-muted/10">
          <AddSnapshotForm onSave={onAddSnapshot} onCancel={onToggleSnap} />
        </div>
      )}
    </div>
  )
}

function AddProductForm({ onSave, onCancel }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [platform, setPlatform]   = useState('jumia')
  const [name, setName]           = useState('')
  const [sku, setSku]             = useState('')
  const [url, setUrl]             = useState('')
  const [category, setCategory]   = useState('')
  const [isOwn, setIsOwn]         = useState(true)
  const [saving, setSaving]       = useState(false)

  const handle = async () => {
    if (!name.trim()) { toast.error('Product name required'); return }
    setSaving(true)
    await onSave({ platform, product_name: name, sku: sku || undefined, product_url: url || undefined, category: category || undefined, is_own_product: isOwn })
    setSaving(false)
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">Add product</p>
        <button onClick={onCancel}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Platform</Label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
            {['jumia', 'konga', 'amazon', 'other'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Product name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Product name" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">SKU</Label>
          <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="Optional" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Product URL</Label>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Category</Label>
          <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Personal Care" className="mt-1" />
        </div>
        <div className="flex items-center gap-2 mt-4">
          <input type="checkbox" id="isOwn" checked={isOwn} onChange={e => setIsOwn(e.target.checked)} className="rounded" />
          <Label htmlFor="isOwn" className="text-xs cursor-pointer">My brand's product</Label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handle} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Add product
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function AddSnapshotForm({ onSave, onCancel }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [price, setPrice]         = useState('')
  const [origPrice, setOrigPrice] = useState('')
  const [rating, setRating]       = useState('')
  const [reviews, setReviews]     = useState('')
  const [position, setPosition]   = useState('')
  const [inStock, setInStock]     = useState(true)
  const [saving, setSaving]       = useState(false)

  const handle = async () => {
    setSaving(true)
    await onSave({
      price:          price ? parseFloat(price) : undefined,
      original_price: origPrice ? parseFloat(origPrice) : undefined,
      rating:         rating ? parseFloat(rating) : undefined,
      review_count:   reviews ? parseInt(reviews) : undefined,
      shelf_position: position ? parseInt(position) : undefined,
      in_stock:       inStock,
    })
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Log a snapshot for today</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Price (₦)</Label>
          <Input value={price} onChange={e => setPrice(e.target.value)} type="number" placeholder="0.00" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Original price</Label>
          <Input value={origPrice} onChange={e => setOrigPrice(e.target.value)} type="number" placeholder="0.00" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Rating (0-5)</Label>
          <Input value={rating} onChange={e => setRating(e.target.value)} type="number" step="0.1" min="0" max="5" placeholder="4.5" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Reviews</Label>
          <Input value={reviews} onChange={e => setReviews(e.target.value)} type="number" placeholder="0" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Shelf position</Label>
          <Input value={position} onChange={e => setPosition(e.target.value)} type="number" placeholder="1" className="mt-1 h-8 text-sm" />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} className="rounded" />
            In stock
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handle} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Save snapshot
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
