/**
 * Catalog write helpers shared by the sync-worker and refresh-show functions.
 * Everything goes through set-based SQL functions so the Edge Function spends
 * almost no CPU time on row-by-row work.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { unwrap } from './supabase.ts'
import {
  channelRows,
  chunk,
  toEpisodeRow,
  toShowRow,
  tvmazeGet,
  type ChannelRow,
  type EpisodeRow,
  type ShowRow,
  type TvmazeEpisode,
  type TvmazeShow,
} from './tvmaze.ts'

export interface UpsertShowsResult {
  inserted: number
  updated: number
}
export interface UpsertEpisodesResult {
  inserted_ids: number[]
  inserted: number
  updated: number
  skipped: number
}

const CHANNEL_BATCH = 500
const SHOW_BATCH = 400
const EPISODE_BATCH = 1000

export async function upsertChannels(db: SupabaseClient, rows: ChannelRow[]): Promise<number> {
  const unique = new Map<string, ChannelRow>()
  for (const r of rows) unique.set(`${r.kind}:${r.tvmaze_id}`, r)
  let touched = 0
  for (const batch of chunk([...unique.values()], CHANNEL_BATCH)) {
    touched += unwrap(await db.rpc('upsert_channels', { p_rows: batch }), 'upsert_channels') as number
  }
  return touched
}

export async function upsertShows(db: SupabaseClient, rows: ShowRow[]): Promise<UpsertShowsResult> {
  const total: UpsertShowsResult = { inserted: 0, updated: 0 }
  for (const batch of chunk(rows, SHOW_BATCH)) {
    const r = unwrap(await db.rpc('upsert_shows', { p_rows: batch }), 'upsert_shows') as UpsertShowsResult
    total.inserted += r.inserted
    total.updated += r.updated
  }
  return total
}

export async function upsertEpisodes(db: SupabaseClient, rows: EpisodeRow[]): Promise<UpsertEpisodesResult> {
  const total: UpsertEpisodesResult = { inserted_ids: [], inserted: 0, updated: 0, skipped: 0 }
  for (const batch of chunk(rows, EPISODE_BATCH)) {
    const r = unwrap(await db.rpc('upsert_episodes', { p_rows: batch }), 'upsert_episodes') as UpsertEpisodesResult
    total.inserted_ids.push(...(r.inserted_ids ?? []))
    total.inserted += r.inserted
    total.updated += r.updated
    total.skipped += r.skipped
  }
  return total
}

/** Upsert a set of TVMaze show objects (channels first, then shows). */
export async function storeShows(db: SupabaseClient, shows: TvmazeShow[]): Promise<UpsertShowsResult & { channels: number }> {
  const channels = await upsertChannels(db, shows.flatMap(channelRows))
  const result = await upsertShows(db, shows.map(toShowRow))
  return { ...result, channels }
}

export async function notifyNewEpisodes(db: SupabaseClient, episodeIds: number[]): Promise<number> {
  let count = 0
  for (const batch of chunk(episodeIds, 2000)) {
    count += unwrap(
      await db.rpc('create_new_episode_notifications', { p_episode_ids: batch }),
      'create_new_episode_notifications',
    ) as number
  }
  return count
}

/**
 * Fetch one show plus its complete episode list (specials included) and store both.
 * Returns null when TVMaze has no such show.
 */
export async function importShowWithEpisodes(
  db: SupabaseClient,
  tvmazeId: number,
  opts: { notify: boolean },
): Promise<{ show: UpsertShowsResult; episodes: UpsertEpisodesResult; notified: number } | null> {
  const show = await tvmazeGet<TvmazeShow>(`/shows/${tvmazeId}`)
  if (!show) return null
  const episodes = (await tvmazeGet<TvmazeEpisode[]>(`/shows/${tvmazeId}/episodes?specials=1`)) ?? []

  const showResult = await storeShows(db, [show])
  const episodeResult = await upsertEpisodes(db, episodes.map((e) => toEpisodeRow(e, tvmazeId)))
  unwrap(await db.rpc('mark_show_episodes_synced', { p_tvmaze_id: tvmazeId }), 'mark_show_episodes_synced')

  const notified = opts.notify && episodeResult.inserted_ids.length > 0
    ? await notifyNewEpisodes(db, episodeResult.inserted_ids)
    : 0
  return { show: showResult, episodes: episodeResult, notified }
}
