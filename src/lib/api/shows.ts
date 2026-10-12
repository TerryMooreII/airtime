import { invokeFunction, supabase } from '@/lib/supabase'
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

export interface RefreshShowResult {
  refreshed: boolean
  reason?: 'fresh' | 'in_progress'
  episodes?: number
}

const refreshInFlight = new Map<number, Promise<RefreshShowResult>>()

/**
 * Pull a show's full episode list from TVmaze right away (the queue is the fallback).
 * Concurrent calls for the same show share one request; the server also holds a short
 * per-show lock so two browsers cannot import the same show at once.
 */
export function refreshShow(tvmazeId: number): Promise<RefreshShowResult> {
  const existing = refreshInFlight.get(tvmazeId)
  if (existing) return existing
  const p = invokeFunction<RefreshShowResult>('refresh-show', { tvmaze_id: tvmazeId }).finally(
    () => refreshInFlight.delete(tvmazeId),
  )
  refreshInFlight.set(tvmazeId, p)
  return p
}

export const RATING_PROVIDER_LABELS: Record<string, string> = {
  tvmaze: 'TVmaze',
  imdb: 'IMDb',
  rotten_tomatoes: 'Rotten Tomatoes',
  metacritic: 'Metacritic',
  tmdb: 'TMDB',
  thetvdb: 'TheTVDB',
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

/** Map TVmaze show ids to local catalog ids (only ids present locally are returned). */
export async function resolveLocalShows(tvmazeIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  const unique = [...new Set(tvmazeIds)]
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await supabase
      .from('shows')
      .select('id, tvmaze_id')
      .in('tvmaze_id', unique.slice(i, i + 200))
    if (error) throw error
    for (const row of (data ?? []) as { id: number; tvmaze_id: number }[])
      out.set(row.tvmaze_id, row.id)
  }
  return out
}
