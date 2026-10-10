/**
 * refresh-show: lets a signed-in user pull a show's full episode list right away
 * (the queue would do it within a minute anyway). Body: { "tvmaze_id": 123 }.
 */
import { handleOptions, json } from '../_shared/cors.ts'
import { HttpError, requireUser } from '../_shared/auth.ts'
import { importShowWithEpisodes } from '../_shared/catalog.ts'

const STALE_AFTER_MS = 6 * 60 * 60 * 1000

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options

  try {
    const { asService } = await requireUser(req)
    const body = (await req.json().catch(() => ({}))) as { tvmaze_id?: number }
    const tvmazeId = Number(body.tvmaze_id)
    if (!tvmazeId) throw new HttpError(400, 'tvmaze_id is required')

    const { data: show } = await asService
      .from('shows')
      .select('id, episodes_synced_at')
      .eq('tvmaze_id', tvmazeId)
      .maybeSingle()

    const syncedAt = show?.episodes_synced_at ? new Date(show.episodes_synced_at).getTime() : 0
    if (show && Date.now() - syncedAt < STALE_AFTER_MS) {
      return json({
        refreshed: false,
        reason: 'fresh',
        episodes_synced_at: show.episodes_synced_at,
      })
    }

    const result = await importShowWithEpisodes(asService, tvmazeId, {
      notify: Boolean(show?.episodes_synced_at),
    })
    if (!result) throw new HttpError(404, 'show not found on TVMaze')

    // The queue may still hold the initial backfill job for this show; it is now redundant.
    await asService
      .from('sync_queue')
      .update({ status: 'cancelled' })
      .eq('job_type', 'show_episodes')
      .eq('status', 'queued')
      .contains('payload', { tvmaze_id: tvmazeId })

    return json({ refreshed: true, episodes: result.episodes.inserted + result.episodes.updated })
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    console.error('refresh-show failed', err)
    return json({ error: err instanceof Error ? err.message : 'error' }, status)
  }
})
