import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { ToolId } from './registry'

/**
 * Anonymous analysis sessions.
 *
 * A visitor finishes a tool and gets a token. The token is the only thing that
 * proves the report is theirs, so it is 32 random bytes and the table stores
 * only its SHA-256: a leaked backup hands nobody a stranger's report, and a
 * run id appearing in a log hands nobody anything either.
 *
 * Service role throughout, which is correct for an unauthenticated caller and
 * is why none of these functions take an id from the request and trust it. The
 * lookup is always by token hash, which the caller can only produce by holding
 * the token. `claimRun` is the one authenticated path, and it verifies the
 * caller's workspace itself rather than taking a workspace id from the body.
 */

export type RunStatus = 'running' | 'complete' | 'failed' | 'insufficient_evidence'

export interface ToolRun<R = unknown> {
  id:          string
  toolId:      ToolId
  status:      RunStatus
  inputs:      Record<string, unknown>
  result:      R | null
  failureNote: string | null
  coverage:    Record<string, unknown>
  createdAt:   string
  claimed:     boolean
  brandId:     string | null
  workspaceId: string | null
}

export interface MintedRun<R = unknown> extends ToolRun<R> {
  /** Shown to the visitor once, in the URL. Never stored. */
  token: string
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export function newToken(): string {
  return randomBytes(32).toString('base64url')
}

export function ipOf(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

export function hashIp(ip: string): string {
  return sha(ip).slice(0, 32)
}

/** Constant-time compare, for the one place we hold two tokens. */
export function tokensMatch(a: string, b: string): boolean {
  const ba = Buffer.from(sha(a), 'hex')
  const bb = Buffer.from(sha(b), 'hex')
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

interface RunRow {
  id: string
  tool_id: string
  status: RunStatus
  inputs: Record<string, unknown> | null
  result: unknown
  failure_note: string | null
  coverage: Record<string, unknown> | null
  created_at: string
  claimed_at: string | null
  brand_id: string | null
  workspace_id: string | null
}

const SELECT = 'id, tool_id, status, inputs, result, failure_note, coverage, created_at, claimed_at, brand_id, workspace_id'

function toRun<R>(row: RunRow): ToolRun<R> {
  return {
    id:          row.id,
    toolId:      row.tool_id as ToolId,
    status:      row.status,
    inputs:      row.inputs ?? {},
    result:      (row.result ?? null) as R | null,
    failureNote: row.failure_note,
    coverage:    row.coverage ?? {},
    createdAt:   row.created_at,
    claimed:     row.claimed_at !== null,
    brandId:     row.brand_id,
    workspaceId: row.workspace_id,
  }
}

/** Open a run before the work starts, so a tool that times out still leaves a
 *  row the visitor's page can poll and the founder's funnel can count. */
export async function startRun(args: {
  toolId: ToolId
  inputs: Record<string, unknown>
  req: NextRequest
  ipHash?: string
}): Promise<{ id: string; token: string }> {
  const token = newToken()
  const svc = await createServiceClient()
  const { data, error } = await svc.from('tool_runs').insert({
    tool_id:    args.toolId,
    token_hash: sha(token),
    inputs:     args.inputs,
    status:     'running',
    ip_hash:    args.ipHash ?? hashIp(ipOf(args.req)),
    referrer:   args.req.headers.get('referer')?.slice(0, 300) ?? null,
    user_agent: args.req.headers.get('user-agent')?.slice(0, 300) ?? null,
  }).select('id').single()

  if (error || !data) throw new Error(`could not open a tool run: ${error?.message ?? 'no row'}`)
  return { id: data.id, token }
}

export async function finishRun(args: {
  id: string
  status: Exclude<RunStatus, 'running'>
  result?: unknown
  coverage?: Record<string, unknown>
  failureNote?: string
}): Promise<void> {
  const svc = await createServiceClient()
  await svc.from('tool_runs').update({
    status:       args.status,
    result:       args.result ?? null,
    coverage:     args.coverage ?? {},
    failure_note: args.failureNote ?? null,
  }).eq('id', args.id)
}

/** The visitor's own read, by token. */
export async function runByToken<R>(token: string): Promise<ToolRun<R> | null> {
  if (!token || token.length < 20) return null
  const svc = await createServiceClient()
  const { data } = await svc.from('tool_runs').select(SELECT).eq('token_hash', sha(token)).maybeSingle()
  return data ? toRun<R>(data as RunRow) : null
}

export async function runById<R>(id: string): Promise<ToolRun<R> | null> {
  const svc = await createServiceClient()
  const { data } = await svc.from('tool_runs').select(SELECT).eq('id', id).maybeSingle()
  return data ? toRun<R>(data as RunRow) : null
}

export type ClaimOutcome =
  | { ok: true; run: ToolRun; brandId: string; workspaceId: string; alreadyClaimed: boolean }
  | { ok: false; reason: 'not_found' | 'taken' | 'no_workspace' | 'not_complete' }

/**
 * Attach a run to the caller's workspace.
 *
 * The caller's workspace is read from their own membership, never taken from
 * the request: this runs with the service role, so a workspace id in a body
 * would be a cross-tenant write. A run another workspace already holds is
 * refused; the same workspace claiming twice is idempotent, because a visitor
 * who signs in again on the same link should land in the same place.
 */
export async function claimRun(token: string, userId: string): Promise<ClaimOutcome> {
  const svc = await createServiceClient()

  const { data: row } = await svc.from('tool_runs').select(SELECT).eq('token_hash', sha(token)).maybeSingle()
  if (!row) return { ok: false, reason: 'not_found' }
  const run = toRun(row as RunRow)
  if (run.status === 'running') return { ok: false, reason: 'not_complete' }

  const { data: member } = await svc
    .from('workspace_members').select('workspace_id').eq('user_id', userId).limit(1).maybeSingle()
  if (!member?.workspace_id) return { ok: false, reason: 'no_workspace' }

  if (run.workspaceId && run.workspaceId !== member.workspace_id) return { ok: false, reason: 'taken' }

  const { data: brand } = await svc
    .from('brands').select('id, name').eq('workspace_id', member.workspace_id)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!brand?.id) return { ok: false, reason: 'no_workspace' }

  if (run.workspaceId === member.workspace_id && run.brandId) {
    return { ok: true, run, brandId: run.brandId, workspaceId: member.workspace_id, alreadyClaimed: true }
  }

  await svc.from('tool_runs').update({
    claimed_by:   userId,
    workspace_id: member.workspace_id,
    brand_id:     brand.id,
    claimed_at:   new Date().toISOString(),
  }).eq('id', run.id)

  return { ok: true, run, brandId: brand.id, workspaceId: member.workspace_id, alreadyClaimed: false }
}
