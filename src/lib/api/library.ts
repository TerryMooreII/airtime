import { many, one } from '@/lib/api/_query'
import { supabase } from '@/lib/supabase'
import type { LibraryEntry, UserShow } from '@/types/domain'

export const LIBRARY_SELECT =
  'user_id, show_id, status, rating, notes, notify, added_at, updated_at, show:shows(id, tvmaze_id, name, status, image_medium, genres, premiered, type, network:channels!shows_network_id_fkey(name, country_code), web_channel:channels!shows_web_channel_id_fkey(name))'

export function fetchLibrary(userId: string): Promise<LibraryEntry[]> {
  return many<LibraryEntry>(
    supabase
      .from('user_shows')
      .select(LIBRARY_SELECT)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  )
}

export type UserShowPatch = Pick<UserShow, 'user_id' | 'show_id'> &
  Partial<Pick<UserShow, 'status' | 'rating' | 'notes' | 'notify'>>

/**
 * Insert or update one tracked show and return it with its catalog row. An upsert so a stale
 * tab (or a show untracked elsewhere) never fails with "0 rows".
 */
export async function upsertUserShow(row: UserShowPatch): Promise<LibraryEntry> {
  const entry = await one<LibraryEntry>(
    supabase
      .from('user_shows')
      .upsert(row, { onConflict: 'user_id,show_id' })
      .select(LIBRARY_SELECT)
      .single(),
  )
  if (!entry) throw new Error('user_shows upsert returned no row')
  return entry
}

/** Bulk upsert (CSV import); returns the stored rows so the store can merge them. */
export function upsertUserShows(rows: UserShowPatch[]): Promise<LibraryEntry[]> {
  return many<LibraryEntry>(
    supabase.from('user_shows').upsert(rows, { onConflict: 'user_id,show_id' }).select(LIBRARY_SELECT),
  )
}

export async function deleteUserShow(userId: string, showId: number): Promise<void> {
  await one(supabase.from('user_shows').delete().eq('user_id', userId).eq('show_id', showId))
}
