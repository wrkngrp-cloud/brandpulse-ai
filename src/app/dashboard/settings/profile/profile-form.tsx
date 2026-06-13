'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateProfile, changePassword, deleteAccount } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { TriangleAlert } from 'lucide-react'

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, null)
  const [pwState,      pwAction,      pwPending]      = useActionState(changePassword, null)

  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [confirmInput,  setConfirmInput]  = useState('')
  const [deletePending, startDeleteTransition] = useTransition()
  const [deleteError,   setDeleteError]   = useState<string | null>(null)

  useEffect(() => {
    if (profileState?.success) toast.success('Name updated.')
    if (profileState?.error)   toast.error(profileState.error)
  }, [profileState])

  useEffect(() => {
    if (pwState?.success) toast.success('Password changed.')
    if (pwState?.error)   toast.error(pwState.error)
  }, [pwState])

  function handleDelete() {
    if (confirmInput !== 'DELETE') return
    startDeleteTransition(async () => {
      const result = await deleteAccount()
      if (result?.error) setDeleteError(result.error)
    })
  }

  return (
    <div className="space-y-8">
      {/* ── Profile info ── */}
      <section className="border rounded-xl p-5 space-y-4 bg-card">
        <h2 className="text-sm font-semibold">Profile</h2>
        <form action={profileAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" defaultValue={name} required className="max-w-sm" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} readOnly disabled className="max-w-sm bg-muted cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">Email changes are not supported at this time.</p>
          </div>
          <Button type="submit" disabled={profilePending} size="sm">
            {profilePending ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </section>

      {/* ── Change password ── */}
      <section className="border rounded-xl p-5 space-y-4 bg-card">
        <div>
          <h2 className="text-sm font-semibold">Change password</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Must be at least 8 characters.</p>
        </div>
        <form action={pwAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" minLength={8} required className="max-w-sm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" minLength={8} required className="max-w-sm" />
          </div>
          <Button type="submit" variant="outline" disabled={pwPending} size="sm">
            {pwPending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </section>

      {/* ── Danger zone ── */}
      <section className="border border-destructive/40 rounded-xl p-5 space-y-4 bg-card">
        <div>
          <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permanently deletes your account, brand, and all associated data. This cannot be undone.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => { setConfirmInput(''); setDeleteError(null); setDeleteOpen(true) }}
        >
          Delete account
        </Button>
      </section>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <TriangleAlert className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle>Delete account</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This permanently deletes your account, your brand profile, all social connections, mentions, sentiment data, surveys, and conversation history. There is no recovery.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="deleteConfirm" className="text-sm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="deleteConfirm"
              value={confirmInput}
              onChange={e => setConfirmInput(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            {deleteError && (
              <p className="text-xs text-destructive">{deleteError}</p>
            )}
          </div>

          <DialogFooter>
            <DialogClose
              render={<button type="button" />}
              className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              disabled={confirmInput !== 'DELETE' || deletePending}
              onClick={handleDelete}
            >
              {deletePending ? 'Deleting…' : 'Yes, delete everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
