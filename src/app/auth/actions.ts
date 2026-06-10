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

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
