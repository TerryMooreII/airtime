import { many, one } from '@/lib/api/_query'
import { supabase } from '@/lib/supabase'
import type { PushDevice } from '@/types/domain'

/** The signed-in user's push registrations, newest first (RLS limits rows to the owner). */
export function fetchPushDevices(): Promise<PushDevice[]> {
  return many<PushDevice>(
    supabase
      .from('push_subscriptions')
      .select('id, endpoint, user_agent, created_at, last_success_at, failed_at')
      .order('created_at', { ascending: false }),
  )
}

export async function removePushDevice(id: number): Promise<void> {
  await one(supabase.from('push_subscriptions').delete().eq('id', id))
}
