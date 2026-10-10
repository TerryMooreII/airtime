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

/** True when the request carries the project's service-role key (cron / internal calls). */
export function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token.length > 0 && token === env('SUPABASE_SERVICE_ROLE_KEY')
}

export function requireServiceRole(req: Request): void {
  if (!isServiceRoleRequest(req)) throw new HttpError(401, 'service role required')
}

export interface CallerContext {
  user: User
  /** Client scoped to the caller (RLS enforced). */
  asUser: SupabaseClient
  /** Service-role client for privileged work the handler has already authorized. */
  asService: SupabaseClient
  isAdmin: boolean
}

export async function requireUser(req: Request): Promise<CallerContext> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) throw new HttpError(401, 'missing authorization header')

  const asUser = userClient(authHeader)
  const { data, error } = await asUser.auth.getUser()
  if (error || !data.user) throw new HttpError(401, 'invalid session')

  const asService = serviceClient()
  const { data: profile } = await asService
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  return { user: data.user, asUser, asService, isAdmin: profile?.role === 'admin' }
}

export async function requireAdmin(req: Request): Promise<CallerContext> {
  const ctx = await requireUser(req)
  if (!ctx.isAdmin) throw new HttpError(403, 'admin only')
  return ctx
}
