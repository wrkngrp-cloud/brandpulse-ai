'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createSurvey } from './actions'

export function LaunchPerceptionAuditButton() {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [name,    setName]    = useState('Q2 Brand Perception Audit')
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      try {
        const id = await createSurvey(name.trim(), 'perception_audit')
        setOpen(false)
        setName('Q2 Brand Perception Audit')
        toast.success('Perception Audit created! Share the link to start collecting responses.')
        router.push(`/dashboard/surveys/${id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create survey')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1.5" />
          Launch Perception Audit
        </Button>
      } />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Perception Audit</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          12 questions · measures Quality, Trust, Innovation, Value, Cultural Relevance, Accessibility, Reliability, and Emotional Connection.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="pa-name">Survey name</Label>
            <Input
              id="pa-name"
              placeholder="e.g. Q2 Brand Perception Audit"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim() || pending}>
            {pending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : 'Create and configure'
            }
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
