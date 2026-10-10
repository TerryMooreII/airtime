/**
 * sync-worker: drains the public.sync_queue table.
 *
 * Invoked every minute by pg_cron (via pg_net) with the service-role key. It
 * responds 202 immediately and keeps processing jobs in the background until the
 * time budget is used up or the queue is empty. Each job writes a sync_runs row.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { handleOptions, json } from '../_shared/cors.ts'
import { HttpError, requireInternal } from '../_shared/auth.ts'
import { serviceClient, unwrap } from '../_shared/supabase.ts'
import {
  importShowWithEpisodes,
  notifyNewEpisodes,
  storeShows,
  upsertEpisodes,
} from '../_shared/catalog.ts'
import {
  showIdFromLinks,
  toEpisodeRow,
  tvmazeGet,
  type TvmazeEpisode,
  type TvmazeShow,
} from '../_shared/tvmaze.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

type JobType = 'catalog_page' | 'full_schedule' | 'show_updates' | 'show_refresh' | 'show_episodes'

interface Job {
  id: number
  job_type: JobType
  payload: Record<string, unknown>
  attempts: number
}

type Stats = Record<string, unknown>

const TIME_BUDGET_MS = Number(Deno.env.get('SYNC_TIME_BUDGET_MS') ?? 90_000)
const CLAIM_BATCH = 5
const MAX_CATALOG_PAGES_PER_RUN = 25 // bounds CPU time spent parsing catalog JSON per invocation
const MAX_SHOW_REFRESH_PER_UPDATE = 400

const WORKER_ID = `edge-${crypto.randomUUID().slice(0, 8)}`

// ---------------------------------------------------------------------------
// Job handlers
// ---------------------------------------------------------------------------
async function handleCatalogPage(
  db: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<Stats> {
  const page = Number(payload.page ?? 0)
  const shows = await tvmazeGet<TvmazeShow[]>(`/shows?page=${page}`)

  if (shows === null) {
    // 404 means we ran past the last page: the catalog import is complete.
    unwrap(
      await db.from('app_settings').upsert({
        key: 'catalog_import',
        value: {
          last_page: page - 1,
          completed_at: new Date().toISOString(),
          started_at: await startedAt(db),
        },
      }),
      'app_settings',
    )
    return { page, done: true }
  }

  const result = await storeShows(db, shows)
  unwrap(
    await db.from('app_settings').upsert({
      key: 'catalog_import',
      value: {
        last_page: page,
        completed_at: null,
        started_at: (await startedAt(db)) ?? new Date().toISOString(),
      },
    }),
    'app_settings',
  )
  await db.rpc('enqueue_sync_job', {
    p_job_type: 'catalog_page',
    p_payload: { page: page + 1 },
    p_priority: 50,
    p_triggered_by: 'catalog',
  })
  return { page, shows: shows.length, ...result }
}

async function startedAt(db: SupabaseClient): Promise<string | null> {
  const { data } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'catalog_import')
    .maybeSingle()
  return (data?.value as { started_at?: string } | null)?.started_at ?? null
}

async function handleFullSchedule(db: SupabaseClient): Promise<Stats> {
  const episodes = (await tvmazeGet<TvmazeEpisode[]>('/schedule/full')) ?? []

  const showsById = new Map<number, TvmazeShow>()
  const episodeRows = []
  for (const ep of episodes) {
    const show = ep._embedded?.show
    const showId = show?.id ?? showIdFromLinks(ep)
    if (!showId) continue
    if (show) {
      const existing = showsById.get(showId)
      if (!existing || (show.updated ?? 0) > (existing.updated ?? 0)) showsById.set(showId, show)
    }
    episodeRows.push(toEpisodeRow(ep, showId))
  }

  const shows = await storeShows(db, [...showsById.values()])
  const eps = await upsertEpisodes(db, episodeRows)
  const notified = eps.inserted_ids.length ? await notifyNewEpisodes(db, eps.inserted_ids) : 0

  return {
    feed_episodes: episodes.length,
    shows_seen: showsById.size,
    shows,
    episodes: { inserted: eps.inserted, updated: eps.updated, skipped: eps.skipped },
    notified,
  }
}

async function handleShowUpdates(db: SupabaseClient): Promise<Stats> {
  const updates = (await tvmazeGet<Record<string, number>>('/updates/shows?since=day')) ?? {}
  const stale = unwrap(await db.rpc('stale_shows', { p_updates: updates }), 'stale_shows') as {
    tvmaze_id: number
    episodes_synced: boolean
  }[]

  // Shows with episodes (i.e. tracked by someone) first.
  stale.sort((a, b) => Number(b.episodes_synced) - Number(a.episodes_synced))
  let enqueued = 0
  for (const s of stale.slice(0, MAX_SHOW_REFRESH_PER_UPDATE)) {
    const { data } = await db.rpc('enqueue_sync_job', {
      p_job_type: 'show_refresh',
      p_payload: { tvmaze_id: s.tvmaze_id },
      p_priority: s.episodes_synced ? 40 : 70,
      p_triggered_by: 'updates',
    })
    if (data) enqueued++
  }
  return { reported: Object.keys(updates).length, stale: stale.length, enqueued }
}

async function handleShowRefresh(
  db: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<Stats> {
  const tvmazeId = Number(payload.tvmaze_id)
  if (!tvmazeId) throw new Error('show_refresh requires payload.tvmaze_id')

  const { data: local } = await db
    .from('shows')
    .select('episodes_synced_at')
    .eq('tvmaze_id', tvmazeId)
    .maybeSingle()

  if (local?.episodes_synced_at) {
    const r = await importShowWithEpisodes(db, tvmazeId, { notify: true })
    return r
      ? { tvmaze_id: tvmazeId, mode: 'show+episodes', ...r }
      : { tvmaze_id: tvmazeId, missing: true }
  }

  const show = await tvmazeGet<TvmazeShow>(`/shows/${tvmazeId}`)
  if (!show) return { tvmaze_id: tvmazeId, missing: true }
  const result = await storeShows(db, [show])
  return { tvmaze_id: tvmazeId, mode: 'show', ...result }
}

async function handleShowEpisodes(
  db: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<Stats> {
  const tvmazeId = Number(payload.tvmaze_id)
  if (!tvmazeId) throw new Error('show_episodes requires payload.tvmaze_id')
  // Initial backfill: never notify, users would get one alert per historical episode.
  const r = await importShowWithEpisodes(db, tvmazeId, { notify: false })
  return r ? { tvmaze_id: tvmazeId, ...r } : { tvmaze_id: tvmazeId, missing: true }
}

async function runJob(db: SupabaseClient, job: Job): Promise<Stats> {
  switch (job.job_type) {
    case 'catalog_page':
      return handleCatalogPage(db, job.payload)
    case 'full_schedule':
      return handleFullSchedule(db)
    case 'show_updates':
      return handleShowUpdates(db)
    case 'show_refresh':
      return handleShowRefresh(db, job.payload)
    case 'show_episodes':
      return handleShowEpisodes(db, job.payload)
    default:
      throw new Error(`unknown job type ${job.job_type satisfies never}`)
  }
}

// ---------------------------------------------------------------------------
// Queue loop
// ---------------------------------------------------------------------------
async function drainQueue(db: SupabaseClient): Promise<void> {
  const deadline = Date.now() + TIME_BUDGET_MS
  let catalogPages = 0
  let processed = 0

  while (Date.now() < deadline) {
    const jobs = unwrap(
      await db.rpc('claim_sync_jobs', { p_worker: WORKER_ID, p_limit: CLAIM_BATCH }),
      'claim_sync_jobs',
    ) as Job[]
    if (!jobs.length) break

    for (const job of jobs) {
      if (
        Date.now() >= deadline ||
        (job.job_type === 'catalog_page' && catalogPages >= MAX_CATALOG_PAGES_PER_RUN)
      ) {
        // Hand it back untouched for the next tick.
        await db
          .from('sync_queue')
          .update({
            status: 'queued',
            locked_at: null,
            locked_by: null,
            attempts: Math.max(0, job.attempts - 1),
          })
          .eq('id', job.id)
        continue
      }
      const started = Date.now()
      try {
        const stats = await runJob(db, job)
        await db.rpc('complete_sync_job', {
          p_job_id: job.id,
          p_ok: true,
          p_stats: { ...stats, duration_ms: Date.now() - started },
        })
        if (job.job_type === 'catalog_page') catalogPages++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[${WORKER_ID}] job ${job.id} (${job.job_type}) failed: ${message}`)
        await db.rpc('complete_sync_job', {
          p_job_id: job.id,
          p_ok: false,
          p_stats: { duration_ms: Date.now() - started },
          p_error: message.slice(0, 2000),
        })
      }
      processed++
    }
    if (catalogPages >= MAX_CATALOG_PAGES_PER_RUN) break
  }
  console.log(`[${WORKER_ID}] processed ${processed} job(s)`)
}

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options

  try {
    await requireInternal(req)
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    return json({ error: err instanceof Error ? err.message : 'error' }, status)
  }

  const db = serviceClient()
  const work = drainQueue(db).catch((err) => console.error(`[${WORKER_ID}] drain failed`, err))

  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(work)
    return json({ accepted: true, worker: WORKER_ID }, 202)
  }
  // Local runtimes without background tasks: run inline.
  return work.then(() => json({ accepted: true, worker: WORKER_ID, inline: true }))
})
