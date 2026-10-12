import { many, one } from '@/lib/api/_query'
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types/domain'

const NOTIFICATION_SELECT =
  'id, user_id, type, title, body, show_id, episode_id, data, read_at, created_at'

export function fetchNotifications(from: number, limit: number): Promise<AppNotification[]> {
  return many<AppNotification>(
    supabase
      .from('notifications')
      .select(NOTIFICATION_SELECT)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1),
  )
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationsRead(ids: number[]): Promise<void> {
  await one(supabase.rpc('mark_notifications_read', { p_ids: ids }))
}

export async function markAllNotificationsRead(): Promise<void> {
  await one(supabase.rpc('mark_all_notifications_read'))
}

export async function deleteNotification(id: number): Promise<void> {
  await one(supabase.from('notifications').delete().eq('id', id))
}

/** Creates a notification for the signed-in user and triggers push delivery immediately. */
export async function sendTestNotification(): Promise<number> {
  return (await one<number>(supabase.rpc('send_test_notification'))) ?? 0
}
