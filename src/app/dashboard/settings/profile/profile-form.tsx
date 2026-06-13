'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { updateProfile, changePassword } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, null)
  const [pwState,      pwAction,      pwPending]      = useActionState(changePassword, null)

  useEffect(() => {
    if (profileState?.success) toast.success('Name updated.')
    if (profileState?.error)   toast.error(profileState.error)
  }, [profileState])

  useEffect(() => {
    if (pwState?.success) toast.success('Password changed.')
    if (pwState?.error)   toast.error(pwState.error)
  }, [pwState])

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
    </div>
  )
}
