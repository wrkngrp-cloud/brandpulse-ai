'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SuccessDialogProps {
  open: boolean
  title: string
  description?: string
  viewHref: string
  viewLabel?: string
  closeHref: string
  closeLabel?: string
}

export function SuccessDialog({
  open,
  title,
  description,
  viewHref,
  viewLabel = 'View',
  closeHref,
  closeLabel = 'Close',
}: SuccessDialogProps) {
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={() => router.push(closeHref)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex flex-col items-center text-center gap-3 pt-2">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-base">{title}</DialogTitle>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </DialogHeader>
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push(closeHref)}
          >
            {closeLabel}
          </Button>
          <Button
            className="flex-1"
            onClick={() => router.push(viewHref)}
          >
            {viewLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
