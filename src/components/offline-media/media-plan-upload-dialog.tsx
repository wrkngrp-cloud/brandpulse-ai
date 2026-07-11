'use client'

import { useRef, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MediaPlanType = 'radio' | 'tv' | 'print'

interface ImportResult {
  imported: number
  errors: string[]
  warnings: string[]
}

interface MediaPlanUploadDialogProps {
  type: MediaPlanType
  templateUrl: string
  onImported?: (result: ImportResult) => void
}

const TYPE_LABELS: Record<MediaPlanType, string> = {
  radio: 'Radio Buy Plan',
  tv:    'TV Buy Plan',
  print: 'Print Placement Plan',
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error'

export function MediaPlanUploadDialog({
  type,
  templateUrl,
  onImported,
}: MediaPlanUploadDialogProps) {
  const [open, setOpen]           = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [result, setResult]       = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg]   = useState<string | null>(null)
  const [fileName, setFileName]   = useState<string | null>(null)
  const fileInputRef              = useRef<HTMLInputElement>(null)

  const reset = () => {
    setUploadState('idle')
    setResult(null)
    setErrorMsg(null)
    setFileName(null)
  }

  const doUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setErrorMsg('Only .xlsx files are supported.')
      setUploadState('error')
      return
    }

    setFileName(file.name)
    setUploadState('uploading')
    setResult(null)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    try {
      const res = await fetch('/api/media-plan/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json() as ImportResult & { error?: string }

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Upload failed. Please try again.')
        setUploadState('error')
        return
      }

      setResult(data)
      setUploadState('success')
      onImported?.(data)
    } catch {
      setErrorMsg('Network error. Check your connection and try again.')
      setUploadState('error')
    }
  }, [type, onImported])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void doUpload(file)
    // Reset input so the same file can be re-uploaded
    e.target.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setUploadState('idle')
    const file = e.dataTransfer.files?.[0]
    if (file) void doUpload(file)
  }, [doUpload])

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setUploadState('dragging')
  }

  const onDragLeave = () => {
    if (uploadState === 'dragging') setUploadState('idle')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    setOpen(next)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
        <Upload className="h-4 w-4" />
        Upload Media Plan
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Upload {TYPE_LABELS[type]}</DialogTitle>
            <DialogDescription>
              Upload your {TYPE_LABELS[type].toLowerCase()} in .xlsx format. BrandGauge will import
              each row and match stations/channels/publications to the reference database.
            </DialogDescription>
          </DialogHeader>

          {/* Drop zone */}
          {(uploadState === 'idle' || uploadState === 'dragging') && (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'mt-2 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer',
                uploadState === 'dragging'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30',
              )}
            >
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {uploadState === 'dragging' ? 'Drop your file here' : 'Drag & drop your .xlsx file here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse — max 5 MB</p>
              </div>
            </div>
          )}

          {/* Uploading state */}
          {uploadState === 'uploading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm font-medium">Importing {fileName}…</p>
              <p className="text-xs text-muted-foreground">Matching stations and validating rows</p>
            </div>
          )}

          {/* Success state */}
          {uploadState === 'success' && result && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">
                    {result.imported} {result.imported === 1 ? 'row' : 'rows'} imported
                  </p>
                  <p className="text-xs text-muted-foreground">{fileName}</p>
                </div>
              </div>

              {result.warnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">{result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}</p>
                  </div>
                  <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                    {result.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                    {result.warnings.length > 5 && <li>…and {result.warnings.length - 5} more</li>}
                  </ul>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <p className="text-xs font-semibold text-red-800">{result.errors.length} row{result.errors.length > 1 ? 's' : ''} skipped</p>
                  </div>
                  <ul className="text-xs text-red-700 space-y-0.5 list-disc list-inside">
                    {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {result.errors.length > 5 && <li>…and {result.errors.length - 5} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {uploadState === 'error' && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Upload failed</p>
                <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onFileChange}
          />

          <DialogFooter showCloseButton={uploadState !== 'uploading'}>
            {uploadState === 'success' && (
              <Button variant="outline" onClick={reset} className="gap-2">
                <Upload className="h-4 w-4" />
                Upload another file
              </Button>
            )}
            {uploadState === 'error' && (
              <Button variant="outline" onClick={reset}>
                Try again
              </Button>
            )}
            <a
              href={templateUrl}
              download
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Download template
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
