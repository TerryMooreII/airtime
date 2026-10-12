import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import { requireUserId } from '@/lib/api/session'
import {
  fetchShowProgress,
  fetchWatchedEpisodeIds,
  markSeasonWatched,
  markWatched,
  unmarkWatched,
} from '@/lib/api/watched'
import type { ShowProgress } from '@/types/domain'

/** Which episodes the signed-in user has watched, loaded per show on demand. */
export const useWatchedStore = defineStore('watched', () => {
  const watched = reactive(new Set<number>())
  /** Episode ids loaded per show, so a reload can drop stale ones. Not reactive on purpose. */
  const idsByShow = new Map<number, number[]>()
  const progress = ref(new Map<number, ShowProgress>())

  async function loadForShow(showId: number): Promise<void> {
    const ids = await fetchWatchedEpisodeIds(showId)
    for (const id of idsByShow.get(showId) ?? []) watched.delete(id)
    for (const id of ids) watched.add(id)
    idsByShow.set(showId, ids)
  }

  function isWatched(episodeId: number): boolean {
    return watched.has(episodeId)
  }

  /** Optimistic toggle; the set is rolled back if the request fails. */
  async function toggle(episodeId: number): Promise<boolean> {
    const userId = requireUserId()
    const wasWatched = watched.has(episodeId)
    if (wasWatched) watched.delete(episodeId)
    else watched.add(episodeId)
    try {
      if (wasWatched) await unmarkWatched(userId, [episodeId])
      else await markWatched(userId, episodeId)
    } catch (err) {
      if (wasWatched) watched.add(episodeId)
      else watched.delete(episodeId)
      throw err
    }
    return !wasWatched
  }

  /** Mark or clear every aired episode of a season. `airedIds` are the season's aired episode ids. */
  async function setSeason(
    showId: number,
    season: number,
    airedIds: number[],
    value: boolean,
  ): Promise<void> {
    if (value) {
      await markSeasonWatched(showId, season)
      for (const id of airedIds) watched.add(id)
    } else {
      await unmarkWatched(requireUserId(), airedIds)
      for (const id of airedIds) watched.delete(id)
    }
  }

  async function loadProgress(): Promise<void> {
    progress.value = new Map((await fetchShowProgress()).map((p) => [p.show_id, p]))
  }

  function reset(): void {
    watched.clear()
    idsByShow.clear()
    progress.value = new Map()
  }

  return { watched, progress, loadForShow, isWatched, toggle, setSeason, loadProgress, reset }
})
