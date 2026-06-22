'use client'

import { useState, useRef, useCallback } from 'react'
import { toast }    from 'sonner'
import { Button }   from '@/components/ui/button'
import { cn }       from '@/lib/utils'
import { Upload, FileText, CheckCircle, AlertCircle, ShoppingCart, Truck, Package } from 'lucide-react'

type Source = 'jumia' | 'konga' | 'manual'

interface Campaign { id: string; name: string }

interface ImportResult {
  imported: number
  skipped:  number
  errors:   string[]
}

const PLATFORMS: { id: Source; label: string; icon: React.ElementType; instructions: string }[] = [
  {
    id:           'jumia',
    label:        'Jumia',
    icon:         ShoppingCart,
    instructions: 'Download your order report from Jumia Seller Centre → Reports → Sales Report. Export as CSV.',
  },
  {
    id:           'konga',
    label:        'Konga',
    icon:         Truck,
    instructions: 'Download from Konga Seller Portal → My Sales → Export.',
  },
  {
    id:           'manual',
    label:        'Manual / Other',
    icon:         Package,
    instructions: 'Upload any CSV with columns: date, product, units, amount. Column headers are auto-detected.',
  },
]

function formatNGN(amount: number): string {
  if (amount >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(1)}B`
  if (amount >= 1_000_000)     return `₦${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)         return `₦${(amount / 1_000).toFixed(0)}K`
  return `₦${amount.toLocaleString('en-NG')}`
}

interface Props {
  campaigns: Campaign[]
}

export function EcommerceImportClient({ campaigns }: Props) {
  const [source,       setSource]       = useState<Source>('jumia')
  const [campaignId,   setCampaignId]   = useState('')
  const [file,         setFile]         = useState<File | null>(null)
  const [isDragging,   setIsDragging]   = useState(false)
  const [importing,    setImporting]    = useState(false)
  const [result,       setResult]       = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const platform = PLATFORMS.find(p => p.id === source)!

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast.error('Only CSV files are accepted')
      return
    }
    setFile(f)
    setResult(null)
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  async function handleImport() {
    if (!file) { toast.error('Select a CSV file first'); return }
    setImporting(true)
    try {
      const form = new FormData()
      form.set('file',   file)
      form.set('source', source)
      if (campaignId) form.set('campaign_id', campaignId)

      const res  = await fetch('/api/connectors/ecommerce/import', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Import failed')
        return
      }

      setResult(data as ImportResult)
      toast.success(`Imported ${data.imported} orders`)
    } catch {
      toast.error('Import failed — check your connection and try again')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Platform selector */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">Select platform</h2>
        <div className="grid grid-cols-3 gap-3">
          {PLATFORMS.map(p => {
            const Icon = p.icon
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { setSource(p.id); setResult(null) }}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-colors',
                  source === p.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                {p.label}
              </button>
            )
          })}
        </div>
        <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          {platform.instructions}
        </div>
      </div>

      {/* Campaign attribution */}
      <div className="border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">Campaign attribution <span className="text-muted-foreground font-normal">(optional)</span></h2>
        <select
          value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">No campaign — general import</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Linking to a campaign lets you see attributed revenue on the campaign detail page.
        </p>
      </div>

      {/* File upload */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">Upload CSV</h2>

        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : file
                ? 'border-green-400 bg-green-50/50 dark:border-green-700 dark:bg-green-950/20'
                : 'border-border hover:border-muted-foreground/40',
          )}
        >
          {file ? (
            <>
              <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="text-center">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(file.size / 1024).toFixed(0)} KB · Click to replace
                </p>
              </div>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Drop your CSV here</p>
                <p className="text-xs text-muted-foreground mt-0.5">or click to browse · max 5 MB</p>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          className="sr-only"
        />

        <Button
          onClick={handleImport}
          disabled={!file || importing}
          className="w-full"
        >
          {importing ? 'Importing…' : 'Import sales data'}
        </Button>
      </div>

      {/* Results panel */}
      {result && (
        <div className={cn(
          'border rounded-xl p-5 space-y-4',
          result.imported > 0 ? 'border-green-200 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/10' : 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10',
        )}>
          <div className="flex items-center gap-2">
            {result.imported > 0
              ? <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              : <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />}
            <h2 className="text-sm font-semibold">Import complete</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/60 dark:bg-background/40 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">
                {result.imported.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Imported</p>
            </div>
            <div className="bg-white/60 dark:bg-background/40 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-muted-foreground">
                {result.skipped.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Skipped</p>
            </div>
            <div className="bg-white/60 dark:bg-background/40 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                {result.errors.length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Row errors</p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-destructive">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
