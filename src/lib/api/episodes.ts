import { many, num } from '@/lib/api/_query'
import { supabase } from '@/lib/supabase'
import type { Episode, UpcomingEpisode } from '@/types/domain'

/**
 * Upcoming episodes for the signed-in user's shows. Dropped and muted shows are
 * left out unless `includeAll` is set (the Library's next-air badges want them).
 */
export function fetchUpcomingEpisodes(
  days = 14,
  limit = 200,
  includeAll = false,
): Promise<UpcomingEpisode[]> {
  return many<UpcomingEpisode>(
    supabase.rpc(includeAll ? 'my_upcoming_episodes_all' : 'my_upcoming_episodes', {
      p_days: days,
      p_limit: limit,
    }),
  )
}

/** Upcoming episodes across the whole catalog (Guide "Everything" scope). */
export function fetchUpcomingEpisodesAll(days = 7, limit = 400): Promise<UpcomingEpisode[]> {
  return many<UpcomingEpisode>(
    supabase.rpc('upcoming_episodes_all', { p_days: days, p_limit: limit }),
  )
}

export interface ShowEpisodes {
  episodes: Episode[]
  /** TVmaze average rating by episode id. */
  ratings: Map<number, number>
}

/** Every episode of a show with its TVmaze rating, in one request. */
export async function fetchShowEpisodes(showId: number): Promise<ShowEpisodes> {
  const rows = await many<Episode & { episode_ratings: { value: string | number }[] }>(
    supabase
      .from('episodes')
      .select(
        'id, season, number, type, name, airdate, airtime, airstamp, runtime, image_medium, summary_html, episode_ratings(value)',
      )
      .eq('show_id', showId)
      .eq('episode_ratings.provider', 'tvmaze')
      .order('season')
      .order('number', { nullsFirst: false })
      .order('airstamp'),
  )
  const ratings = new Map<number, number>()
  const episodes = rows.map(({ episode_ratings, ...e }) => {
    const value = num(episode_ratings?.[0]?.value)
    if (value !== null) ratings.set(e.id, value)
    return e
  })
  return { episodes, ratings }
}
