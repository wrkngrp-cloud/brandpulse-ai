'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadMailAttachment } from './actions'
import { FileIcon, XIcon } from '@/components/brand/icon'

export interface PickedAttachment {
  path: string; name: string; type: string; size: number; signature: string
}

/**
 * Picking a file uploads it right away rather than waiting for Send — the
 * chip it becomes is the only feedback that the upload actually worked, and
 * holding the file in browser memory until Send would mean a failed upload
 * surfaces at the worst possible moment.
 *
 * Renders a hidden input carrying the signed refs as JSON, which is what
 * replyMail/composeMail/saveDraft read and verify server-side — nothing
 * here is trusted on its own.
 */
export function AttachmentPicker({ name, initial = [] }: { name: string; initial?: PickedAttachment[] }) {
  const [items, setItems] = useState<PickedAttachment[]>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = (file: File) => {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadMailAttachment(fd)
      if ('error' in result) { setError(result.error); return }
      setItems(list => [...list, result])
    })
  }

  return (
    <div className="space-y-1.5">
      <input type="hidden" name={name} value={JSON.stringify(items)} />

      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <li key={item.path} className="flex items-center gap-1 rounded-md border border-line bg-shell px-2 py-1 text-xs">
              <FileIcon className="size-3" />
              <span className="max-w-32 truncate">{item.name}</span>
              <button
                type="button"
                onClick={() => setItems(list => list.filter((_, j) => j !== i))}
                className="text-tx-3 hover:text-tx-1"
                aria-label={`Remove ${item.name}`}
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="bg-press rounded-md border border-line px-2 py-1 text-xs disabled:opacity-50"
        >
          {pending ? 'Uploading…' : 'Attach a file'}
        </button>
        <span className="text-[0.65rem] text-tx-3">Images and PDFs, up to 10MB</span>
      </div>

      {error && <p className="text-xs text-neg" role="alert">{error}</p>}
    </div>
  )
}
