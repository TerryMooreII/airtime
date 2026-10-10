import { supabase } from '@/lib/supabase'
import type { UserShowStatus } from '@/types/domain'

export interface MatchCandidate {
  id: number
  tvmaze_id: number
  name: string
  type: string | null
  status: string | null
  premiered: string | null
  image_medium: string | null
  network_name: string | null
  rating: number | null
  score: number
  is_exact: boolean
}

/** Candidates per input name, keyed by the exact input string. */
export async function matchShowCandidates(
  names: string[],
  limit = 5,
): Promise<Map<string, MatchCandidate[]>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  const out = new Map<string, MatchCandidate[]>()
  for (const n of unique) out.set(n, [])
  // Keep each RPC payload modest.
  for (let i = 0; i < unique.length; i += 40) {
    const batch = unique.slice(i, i + 40)
    const { data, error } = await supabase.rpc('match_show_candidates', {
      p_names: batch,
      p_limit: limit,
    })
    if (error) throw error
    for (const row of (data ?? []) as (MatchCandidate & { query_name: string })[]) {
      const { query_name, ...candidate } = row
      out.get(query_name)?.push(candidate)
    }
  }
  return out
}

export interface ImportItem {
  showId: number
  rating: number | null
}

/** Upsert tracked shows in one request; existing rows keep their status unless overridden. */
export async function importTrackedShows(
  items: ImportItem[],
  status: UserShowStatus,
): Promise<number> {
  if (!items.length) return 0
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('not signed in')
  const rows = items.map((i) => ({ user_id: userId, show_id: i.showId, status, rating: i.rating }))
  const { error, count } = await supabase
    .from('user_shows')
    .upsert(rows, { onConflict: 'user_id,show_id', count: 'exact' })
  if (error) throw error
  return count ?? rows.length
}
