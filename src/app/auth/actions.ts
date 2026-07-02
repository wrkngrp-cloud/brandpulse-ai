'use server'

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type AuthState = { error?: string; fieldErrors?: Record<string, string[]> } | null

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'Signup failed — please try again.' }

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

  redirect('/onboarding')
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
  if (error) return { error: error.message }

  // Login never routes to onboarding directly — only signup does that.
  // Returning users (including demo accounts) always land on /dashboard;
  // dashboard/layout.tsx is the single source of truth that bounces
  // genuinely incomplete accounts (abandoned signup) back to /onboarding.
  redirect('/dashboard')
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
  const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

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
