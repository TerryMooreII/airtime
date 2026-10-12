import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2'
import { env, serviceClient, userClient } from './supabase.ts'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** True when the request carries the project's service-role key. */
export function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token.length > 0 && token === env('SUPABASE_SERVICE_ROLE_KEY')
}

let cachedSyncSecret: { value: string; at: number } | null = null

/** The shared secret pg_cron sends (app_settings.sync_secret), cached for 5 minutes. */
async function syncSecret(): Promise<string | null> {
  if (cachedSyncSecret && Date.now() - cachedSyncSecret.at < 5 * 60_000)
    return cachedSyncSecret.value
  const { data } = await serviceClient()
    .from('app_settings')
    .select('value')
    .eq('key', 'sync_secret')
    .maybeSingle()
  const value = typeof data?.value === 'string' ? data.value : null
  if (value) cachedSyncSecret = { value, at: Date.now() }
  return value
}

/**
 * Internal callers only: either the service-role key as bearer, or the
 * x-sync-secret header pg_cron attaches (see public.invoke_edge_function).
 */
export async function requireInternal(req: Request): Promise<void> {
  if (isServiceRoleRequest(req)) return
  const header = req.headers.get('x-sync-secret')
  const expected = header ? await syncSecret() : null
  if (!header || !expected || header !== expected) throw new HttpError(401, 'internal callers only')
}

export interface CallerContext {
  user: User
  /** Client scoped to the caller (RLS enforced). */
  asUser: SupabaseClient
  /** Service-role client for privileged work the handler has already authorized. */
  asService: SupabaseClient
  isAdmin: boolean
}

/** Verify the caller's session. The profile role is only read when `withRole` is set. */
export async function requireUser(req: Request, withRole = false): Promise<CallerContext> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) throw new HttpError(401, 'missing authorization header')

  const asUser = userClient(authHeader)
  const { data, error } = await asUser.auth.getUser()
  if (error || !data.user) throw new HttpError(401, 'invalid session')

  const asService = serviceClient()
  let isAdmin = false
  if (withRole) {
    const { data: profile, error: profileError } = await asService
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()
    if (profileError) throw new HttpError(500, `profile lookup: ${profileError.message}`)
    isAdmin = profile?.role === 'admin'
  }

  return { user: data.user, asUser, asService, isAdmin }
}

export async function requireAdmin(req: Request): Promise<CallerContext> {
  const ctx = await requireUser(req, true)
  if (!ctx.isAdmin) throw new HttpError(403, 'admin only')
  return ctx
}
