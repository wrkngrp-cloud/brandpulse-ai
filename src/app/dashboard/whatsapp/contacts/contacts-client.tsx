'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Users, UserCheck, UserX, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Contact } from './page'

interface Props {
  totalCount: number
  optedInCount: number
  contacts: Contact[]
}

export function ContactsClient({ totalCount, optedInCount, contacts }: Props) {
  const [uploading, setUploading] = useState(false)
  const [imported, setImported] = useState<{ count: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please upload a CSV file')
      return
    }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/whatsapp/contacts/import', { method: 'POST', body: fd })
      const data = await res.json() as { imported?: number; skipped?: number; error?: string }
      if (!res.ok || data.error) { toast.error(data.error ?? 'Import failed'); return }
      setImported({ count: data.imported ?? 0 })
      toast.success(`${data.imported} contacts imported${data.skipped ? ` · ${data.skipped} skipped` : ''}`)
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="max-w-3xl space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/whatsapp" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="eyebrow mb-0.5">WhatsApp</p>
          <h1 className="h-display text-[26px] leading-none">Contact list</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total contacts', value: totalCount.toLocaleString(),   icon: Users },
          { label: 'Opted in',       value: optedInCount.toLocaleString(), icon: UserCheck },
          { label: 'Opted out',      value: (totalCount - optedInCount).toLocaleString(), icon: UserX },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="border rounded-xl p-4 bg-card space-y-1">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <p className="text-xl font-bold tracking-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* CSV Upload */}
      <div className="border rounded-xl p-6 bg-card space-y-4">
        <div>
          <p className="text-sm font-semibold">Import contacts</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload a CSV with phone numbers. Columns: <span className="font-mono">name, phone</span> or just <span className="font-mono">phone</span>. Nigerian numbers (080…, 090…, +234…) are all accepted.
          </p>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            uploading ? 'border-primary/30 bg-primary/5' : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/20'
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importing…</p>
            </div>
          ) : imported ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <p className="text-sm font-medium">{imported.count} contacts imported</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to upload a CSV file</p>
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />

        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <strong>NDPR reminder:</strong> Only import numbers from people who have explicitly opted in to receive WhatsApp messages from your brand. Contacts who reply "STOP" are automatically removed.
        </div>
      </div>

      {/* Contact list preview */}
      {contacts.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Recent contacts {totalCount > 100 && `(showing 100 of ${totalCount.toLocaleString()})`}
          </h2>
          <div className="border rounded-xl bg-card overflow-hidden divide-y">
            {contacts.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  c.whatsapp_opted_in ? 'bg-green-500' : 'bg-muted-foreground/30'
                )} />
                <div className="flex-1 min-w-0">
                  {c.name && <p className="text-sm font-medium truncate">{c.name}</p>}
                  <p className={cn('font-mono text-xs', c.name ? 'text-muted-foreground' : 'text-foreground')}>{c.phone_e164}</p>
                </div>
                <span className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0',
                  c.whatsapp_opted_in
                    ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {c.whatsapp_opted_in ? 'Opted in' : 'Opted out'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {contacts.length === 0 && (
        <div className="border rounded-xl p-8 bg-card text-center text-sm text-muted-foreground">
          No contacts yet. Upload a CSV to get started.
        </div>
      )}
    </div>
  )
}
