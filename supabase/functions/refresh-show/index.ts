/**
 * refresh-show: lets a signed-in user pull a show's full episode list right away
 * (the queue would do it within a minute anyway). Body: { "tvmaze_id": 123 }.
 * Responses: { refreshed: true, episodes } | { refreshed: false, reason: 'fresh' | 'in_progress' }.
 */
import { json } from '../_shared/cors.ts'
import { HttpError, requireUser } from '../_shared/auth.ts'
import { getLocalShow, importShowWithEpisodes } from '../_shared/catalog.ts'
import { serve } from '../_shared/serve.ts'
import { unwrap } from '../_shared/supabase.ts'

const STALE_AFTER_MS = 6 * 60 * 60 * 1000

serve('refresh-show', async (req) => {
  const { asService } = await requireUser(req)
  const body = (await req.json().catch(() => ({}))) as { tvmaze_id?: number }
  const tvmazeId = Number(body.tvmaze_id)
  if (!tvmazeId) throw new HttpError(400, 'tvmaze_id is required')

  const show = await getLocalShow(asService, tvmazeId)
  const syncedAt = show?.episodes_synced_at ? new Date(show.episodes_synced_at).getTime() : 0
  if (show && Date.now() - syncedAt < STALE_AFTER_MS) {
    return json({ refreshed: false, reason: 'fresh', episodes_synced_at: show.episodes_synced_at })
  }

  const result = await importShowWithEpisodes(asService, tvmazeId, {
    notify: Boolean(show?.episodes_synced_at),
  })
  if (!result) throw new HttpError(404, 'show not found on TVMaze')
  if ('in_progress' in result) return json({ refreshed: false, reason: 'in_progress' })

  // The queue may still hold a backfill or refresh job for this show; it is now redundant.
  // Equality on the jsonb payload uses sync_queue_pending_unique_idx (job_type, payload).
  unwrap(
    await asService
      .from('sync_queue')
      .update({ status: 'cancelled' })
      .in('job_type', ['show_episodes', 'show_refresh'])
      .eq('status', 'queued')
      .eq('payload', JSON.stringify({ tvmaze_id: tvmazeId })),
    'cancel queued jobs',
  )

  return json({ refreshed: true, episodes: result.episodes.inserted + result.episodes.updated })
})
