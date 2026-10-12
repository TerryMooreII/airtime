import { many, mapChunks, num } from '@/lib/api/_query'
import { upsertUserShows } from '@/lib/api/library'
import { requireUserId } from '@/lib/api/session'
import { supabase } from '@/lib/supabase'
import type { LibraryEntry, MatchCandidate, SearchResult, UserShowStatus } from '@/types/domain'

/** Candidates per input name, keyed by the exact (trimmed) input string. */
export async function matchShowCandidates(
  names: string[],
  limit = 5,
): Promise<Map<string, MatchCandidate[]>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  const out = new Map<string, MatchCandidate[]>()
  for (const n of unique) out.set(n, [])
  // Modest RPC payloads, a few in flight at a time.
  const batches = await mapChunks(unique, 40, (batch) =>
    many<MatchCandidate & { query_name: string }>(
      supabase.rpc('match_show_candidates', { p_names: batch, p_limit: limit }),
    ),
  )
  for (const row of batches.flat()) {
    const { query_name, ...candidate } = row
    out.get(query_name)?.push({ ...candidate, rating: num(candidate.rating) })
  }
  return out
}

/** A search hit chosen by hand in the import flow, in candidate form. */
export function toMatchCandidate(result: SearchResult): MatchCandidate {
  return {
    id: result.id,
    tvmaze_id: result.tvmaze_id,
    name: result.name,
    type: result.type,
    status: result.status,
    premiered: result.premiered,
    image_medium: result.image_medium,
    network_name: result.network_name,
    rating: result.rating,
    score: 1,
    is_exact: false,
  }
}

export interface ImportItem {
  showId: number
  rating: number | null
}

/** Upsert tracked shows in one request and return the stored rows for the library store. */
export function importTrackedShows(
  items: ImportItem[],
  status: UserShowStatus,
): Promise<LibraryEntry[]> {
  if (!items.length) return Promise.resolve([])
  const userId = requireUserId()
  return upsertUserShows(
    items.map((i) => ({ user_id: userId, show_id: i.showId, status, rating: i.rating })),
  )
}
