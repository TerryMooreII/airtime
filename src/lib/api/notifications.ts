import { supabase } from '@/lib/supabase'

/** Creates a notification for the signed-in user and triggers push delivery immediately. */
export async function sendTestNotification(): Promise<number> {
  const { data, error } = await supabase.rpc('send_test_notification')
  if (error) throw error
  return data as number
}
