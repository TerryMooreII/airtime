import { supabase } from '@/lib/supabase'
import type { DiscoverRails } from '@/types/domain'

export async function fetchDiscoverRails(): Promise<DiscoverRails> {
  const { data, error } = await supabase.rpc('discover_rails')
  if (error) throw error
  return data as unknown as DiscoverRails
}
