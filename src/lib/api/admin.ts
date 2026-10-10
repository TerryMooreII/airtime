import type { Json } from '@/lib/database.types'
import { invokeFunction, supabase } from '@/lib/supabase'
import type {
  AdminStats,
  AdminUser,
  AppRole,
  SyncJobType,
  SyncQueueJob,
  SyncRun,
} from '@/types/domain'

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) throw error
  return data as unknown as AdminStats
}

export async function fetchSyncQueue(limit = 50): Promise<SyncQueueJob[]> {
  const { data, error } = await supabase
    .from('sync_queue')
    .select(
      'id, job_type, payload, priority, run_after, attempts, max_attempts, status, locked_at, last_error, triggered_by, created_at',
    )
    .in('status', ['queued', 'running', 'failed'])
    .order('status')
    .order('priority')
    .order('id')
    .limit(limit)
  if (error) throw error
  return (data ?? []) as SyncQueueJob[]
}

export async function fetchSyncRuns(limit = 40): Promise<SyncRun[]> {
  const { data, error } = await supabase
    .from('sync_runs')
    .select('id, job_type, status, started_at, finished_at, stats, error')
    .order('finished_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as SyncRun[]
}

export async function enqueueSync(
  jobType: SyncJobType,
  payload: Record<string, Json> = {},
): Promise<number | null> {
  const { data, error } = await supabase.rpc('admin_enqueue_sync', {
    p_job_type: jobType,
    p_payload: payload,
  })
  if (error) throw error
  return (data as number | null) ?? null
}

export interface AdminUserPage {
  page: number
  perPage: number
  total: number | null
  users: AdminUser[]
}
export function listUsers(page = 1, perPage = 50): Promise<AdminUserPage> {
  return invokeFunction<AdminUserPage>('admin-users', { action: 'list', page, perPage })
}
export function banUser(userId: string, ban: boolean): Promise<{ ok: boolean }> {
  return invokeFunction('admin-users', { action: ban ? 'ban' : 'unban', userId })
}
export function deleteUser(userId: string): Promise<{ ok: boolean }> {
  return invokeFunction('admin-users', { action: 'delete', userId })
}
export async function setUserRole(userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase.rpc('admin_set_role', { p_user_id: userId, p_role: role })
  if (error) throw error
}

export interface AdminShowRow {
  id: number
  tvmaze_id: number
  name: string
  status: string | null
  premiered: string | null
  image_medium: string | null
  episodes_synced_at: string | null
  synced_at: string | null
  tvmaze_updated_at: string | null
  followers: number
}
export async function searchAdminShows(query: string, limit = 40): Promise<AdminShowRow[]> {
  const { data, error } = await supabase.rpc('admin_shows', { p_query: query, p_limit: limit })
  if (error) throw error
  return (data ?? []) as AdminShowRow[]
}
