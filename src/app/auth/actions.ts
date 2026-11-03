'use server'

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { safeNext } from '@/lib/safe-next'

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type AuthState = { error?: string; fieldErrors?: Record<string, string[]>; unconfirmedEmail?: string } | null

const appUrl = () => process.env.APP_URL || 'http://localhost:3000'

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { name, email, password } = parsed.data
  const supabase = await createClient()

  /* A visitor who came from a free tool carries their report through as
     `next`. Onboarding still runs (a brand has to exist before a report can
     be attached to one), but it is handed the destination so they land back on
     their own work rather than on a cold dashboard. The same destination rides
     on the confirmation link, so confirming the email does not lose it. */
  const next = formData.get('next')
  const onward = typeof next === 'string' && next.trim()
    ? `/onboarding?next=${encodeURIComponent(safeNext(next))}`
    : '/onboarding'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${appUrl()}/api/auth/callback?next=${encodeURIComponent(onward)}`,
    },
  })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'Signup did not go through. Please try again.' }

  // Supabase answers a signup for an address that already has an account with
  // a user that has no identities, so it never reveals who is registered. Do
  // not build a second workspace for them; send them to the same screen.
  if (!data.user.identities?.length) {
    redirect(`/auth/check-email?email=${encodeURIComponent(email)}`)
  }

  // Use service role to create workspace + member + blank brand
  // (RLS is not satisfied until the user has a session, so we bypass with service role)
  const service = await createServiceClient()

  const { data: ws, error: wsError } = await service
    .from('workspaces')
    .insert({ name: `${name}'s Workspace` })
    .select('id')
    .single()

  if (wsError || !ws) return { error: 'Could not create workspace.' }

  await service.from('workspace_members').insert({
    workspace_id: ws.id,
    user_id: data.user.id,
    role: 'owner',
  })

  await service.from('brands').insert({
    workspace_id: ws.id,
    name: '',
  })

  // With email confirmation on there is no session yet, and sending them to
  // /onboarding bounced them to a "Welcome back, sign in" page with no word
  // about the email they had just been sent.
  if (!data.session) redirect(`/auth/check-email?email=${encodeURIComponent(email)}`)
  redirect(onward)
}

/** Send the confirmation email again, from the check-your-email screen. */
export async function resendConfirmation(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email')
  if (typeof email !== 'string' || !email.includes('@')) return { error: 'Enter the email you signed up with.' }
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${appUrl()}/api/auth/callback?next=${encodeURIComponent('/onboarding')}` },
  })
  if (error) return { error: error.message }
  return { error: '__sent__' }
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) {
      return {
        error: 'Confirm your email first. We sent you a link when you signed up.',
        unconfirmedEmail: parsed.data.email,
      }
    }
    return { error: error.message }
  }

  // Login never routes to onboarding directly — only signup does that.
  // Returning users (including demo accounts) always land on /dashboard;
  // dashboard/layout.tsx is the single source of truth that bounces
  // genuinely incomplete accounts (abandoned signup) back to /onboarding.
  //
  // The exception is an existing customer arriving from a free tool: they
  // already have a workspace, so they go straight to claiming their report
  // rather than being told to create a second account.
  redirect(safeNext(formData.get('next')))
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export async function forgotPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email')
  if (typeof email !== 'string' || !email.includes('@')) {
    return { error: 'Please enter a valid email address.' }
  }

  const supabase = await createClient()
  const APP_URL = process.env.APP_URL || 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/api/auth/callback?next=/auth/reset-password`,
  })

  if (error) return { error: error.message }

  // Return a special flag so the page can show the confirmation state
  return { error: '__sent__' }
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password    = formData.get('password')
  const confirmPass = formData.get('confirm')

  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }
  if (password !== confirmPass) {
    return { error: 'Passwords do not match.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  redirect('/dashboard')
}
