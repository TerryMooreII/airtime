import { CHANNEL_EMBEDS, many, mapChunks, num, one } from '@/lib/api/_query'
import { invokeFunction, supabase } from '@/lib/supabase'
import type { SearchResult, Show, ShowExternalId, ShowRating } from '@/types/domain'

const SHOW_SELECT = `id, tvmaze_id, name, type, language, genres, status, runtime, average_runtime, premiered, ended, official_site, schedule_time, schedule_days, weight, image_medium, image_original, summary_html, tvmaze_url, episodes_synced_at, ${CHANNEL_EMBEDS}`

export interface ShowDetail {
  show: Show
  ratings: ShowRating[]
  externalIds: ShowExternalId[]
}

interface RawRating {
  provider: string
  value: string | number
  scale: string | number
  vote_count: number | null
}

/** The show with its ratings and external ids in one request. */
export async function fetchShowDetail(id: number): Promise<ShowDetail | null> {
  const row = await one<Show & { show_ratings: RawRating[]; show_external_ids: ShowExternalId[] }>(
    supabase
      .from('shows')
      .select(
        `${SHOW_SELECT}, show_ratings(provider, value, scale, vote_count), show_external_ids(provider, external_id)`,
      )
      .eq('id', id)
      .maybeSingle(),
  )
  if (!row) return null
  const { show_ratings, show_external_ids, ...show } = row
  return {
    show,
    ratings: show_ratings.map((r) => ({
      provider: r.provider,
      value: Number(r.value),
      scale: Number(r.scale),
      vote_count: r.vote_count,
    })),
    externalIds: show_external_ids,
  }
}

/** Full-text + trigram search over the local catalog (search_shows RPC). */
export async function searchShows(query: string, limit = 24, offset = 0): Promise<SearchResult[]> {
  const rows = await many<SearchResult>(
    supabase.rpc('search_shows', { p_query: query, p_limit: limit, p_offset: offset }),
  )
  return rows.map((r) => ({ ...r, rating: num(r.rating) }))
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
  const p = invokeFunction<RefreshShowResult>('refresh-show', { tvmaze_id: tvmazeId }).finally(() =>
    refreshInFlight.delete(tvmazeId),
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
  const unique = [...new Set(tvmazeIds)]
  const batches = await mapChunks(unique, 200, (ids) =>
    many<{ id: number; tvmaze_id: number }>(
      supabase.from('shows').select('id, tvmaze_id').in('tvmaze_id', ids),
    ),
  )
  return new Map(batches.flat().map((row) => [row.tvmaze_id, row.id]))
}
