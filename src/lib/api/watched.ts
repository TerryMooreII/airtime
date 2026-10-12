import { many, one } from '@/lib/api/_query'
import { supabase } from '@/lib/supabase'
import type { ShowProgress } from '@/types/domain'

/** Ids of the signed-in user's watched episodes for one show (RLS scopes the rows). */
export async function fetchWatchedEpisodeIds(showId: number): Promise<number[]> {
  const rows = await many<{ episode_id: number }>(
    supabase
      .from('user_episodes')
      .select('episode_id, episodes!inner(show_id)')
      .eq('episodes.show_id', showId),
  )
  return rows.map((r) => r.episode_id)
}

/** ON CONFLICT DO NOTHING: marking an already-watched episode is a no-op, no UPDATE grant needed. */
export async function markWatched(userId: string, episodeId: number): Promise<void> {
  await one(
    supabase
      .from('user_episodes')
      .upsert(
        { user_id: userId, episode_id: episodeId },
        { onConflict: 'user_id,episode_id', ignoreDuplicates: true },
      ),
  )
}

export async function unmarkWatched(userId: string, episodeIds: number[]): Promise<void> {
  if (!episodeIds.length) return
  await one(
    supabase.from('user_episodes').delete().eq('user_id', userId).in('episode_id', episodeIds),
  )
}

export async function markSeasonWatched(showId: number, season: number): Promise<void> {
  await one(supabase.rpc('mark_season_watched', { p_show_id: showId, p_season: season }))
}

export function fetchShowProgress(): Promise<ShowProgress[]> {
  return many<ShowProgress>(supabase.rpc('my_show_progress'))
}
