import { supabase } from '@/lib/supabase'
import type { Episode, UpcomingEpisode } from '@/types/domain'

export async function fetchUpcomingEpisodes(days = 14, limit = 200): Promise<UpcomingEpisode[]> {
  const { data, error } = await supabase.rpc('my_upcoming_episodes', {
    p_days: days,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as UpcomingEpisode[]
}

export async function fetchEpisodesForShow(showId: number): Promise<Episode[]> {
  const { data, error } = await supabase
    .from('episodes')
    .select(
      'id, tvmaze_id, show_id, season, number, type, name, airdate, airtime, airstamp, runtime, image_medium, summary_html',
    )
    .eq('show_id', showId)
    .order('season')
    .order('number', { nullsFirst: false })
    .order('airstamp')
  if (error) throw error
  return (data ?? []) as Episode[]
}

export async function fetchEpisodeRatings(episodeIds: number[]): Promise<Map<number, number>> {
  if (!episodeIds.length) return new Map()
  const { data } = await supabase
    .from('episode_ratings')
    .select('episode_id, value')
    .in('episode_id', episodeIds)
    .eq('provider', 'tvmaze')
  return new Map(
    (data ?? []).map((r: { episode_id: number; value: number }) => [r.episode_id, Number(r.value)]),
  )
}
