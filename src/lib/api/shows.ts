import { supabase } from '@/lib/supabase'
import type { Show, ShowExternalId, ShowRating } from '@/types/domain'

const SHOW_SELECT =
  'id, tvmaze_id, name, type, language, genres, status, runtime, average_runtime, premiered, ended, official_site, schedule_time, schedule_days, weight, image_medium, image_original, summary_html, tvmaze_url, episodes_synced_at, network:channels!shows_network_id_fkey(id, kind, name, country_code, timezone), web_channel:channels!shows_web_channel_id_fkey(id, kind, name, country_code, timezone)'

export async function fetchShow(id: number): Promise<Show | null> {
  const { data, error } = await supabase
    .from('shows')
    .select(SHOW_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Show | null) ?? null
}

export async function fetchShowRatings(showId: number): Promise<ShowRating[]> {
  const { data, error } = await supabase
    .from('show_ratings')
    .select('provider, value, scale, vote_count')
    .eq('show_id', showId)
  if (error) throw error
  return (data ?? []).map(
    (r: {
      provider: string
      value: string | number
      scale: string | number
      vote_count: number | null
    }) => ({
      provider: r.provider,
      value: Number(r.value),
      scale: Number(r.scale),
      vote_count: r.vote_count,
    }),
  )
}

export async function fetchShowExternalIds(showId: number): Promise<ShowExternalId[]> {
  const { data, error } = await supabase
    .from('show_external_ids')
    .select('provider, external_id')
    .eq('show_id', showId)
  if (error) throw error
  return (data ?? []) as ShowExternalId[]
}

export const RATING_PROVIDER_LABELS: Record<string, string> = {
  tvmaze: 'TVmaze',
  imdb: 'IMDb',
  rotten_tomatoes: 'Rotten Tomatoes',
  metacritic: 'Metacritic',
  tmdb: 'TMDB',
}

export function externalLink(provider: string, id: string): string | null {
  switch (provider) {
    case 'imdb':
      return `https://www.imdb.com/title/${id}/`
    case 'thetvdb':
      return `https://thetvdb.com/?tab=series&id=${id}`
    default:
      return null
  }
}
