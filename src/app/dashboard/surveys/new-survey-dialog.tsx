'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Loader2 } from 'lucide-react'
import { createSurvey } from './actions'

export function NewSurveyDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      const id = await createSurvey(name.trim())
      setOpen(false)
      setName('')
      router.push(`/dashboard/surveys/${id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> New survey
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New B2 intercept survey</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Two questions, 15 seconds. Captures awareness source and NPS.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="survey-name">Survey name</Label>
            <Input
              id="survey-name"
              placeholder="e.g. June awareness pulse"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim() || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create survey'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
