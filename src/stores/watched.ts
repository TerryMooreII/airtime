import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import { supabase } from '@/lib/supabase'
import type { ShowProgress } from '@/types/domain'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('not signed in')
  return id
}

/** Which episodes the signed-in user has watched, loaded per show on demand. */
export const useWatchedStore = defineStore('watched', () => {
  const watched = reactive(new Set<number>())
  const loadedShows = reactive(new Set<number>())
  const progress = ref(new Map<number, ShowProgress>())

  async function loadForEpisodes(showId: number, episodeIds: number[]): Promise<void> {
    if (!episodeIds.length) {
      loadedShows.add(showId)
      return
    }
    const userId = await currentUserId()
    const { data, error } = await supabase
      .from('user_episodes')
      .select('episode_id')
      .eq('user_id', userId)
      .in('episode_id', episodeIds)
    if (error) throw error
    for (const id of episodeIds) watched.delete(id)
    for (const row of (data ?? []) as { episode_id: number }[]) watched.add(row.episode_id)
    loadedShows.add(showId)
  }

  function isWatched(episodeId: number): boolean {
    return watched.has(episodeId)
  }

  async function toggle(episodeId: number): Promise<boolean> {
    const userId = await currentUserId()
    if (watched.has(episodeId)) {
      watched.delete(episodeId)
      const { error } = await supabase
        .from('user_episodes')
        .delete()
        .eq('user_id', userId)
        .eq('episode_id', episodeId)
      if (error) {
        watched.add(episodeId)
        throw error
      }
      return false
    }
    watched.add(episodeId)
    const { error } = await supabase
      .from('user_episodes')
      .upsert(
        { user_id: userId, episode_id: episodeId },
        { onConflict: 'user_id,episode_id', ignoreDuplicates: true },
      )
    if (error) {
      watched.delete(episodeId)
      throw error
    }
    return true
  }

  /** Mark or clear every aired episode of a season. `airedIds` are the season's aired episode ids. */
  async function setSeason(
    showId: number,
    season: number,
    airedIds: number[],
    value: boolean,
  ): Promise<void> {
    if (value) {
      const { error } = await supabase.rpc('mark_season_watched', {
        p_show_id: showId,
        p_season: season,
      })
      if (error) throw error
      for (const id of airedIds) watched.add(id)
    } else {
      const userId = await currentUserId()
      const { error } = await supabase
        .from('user_episodes')
        .delete()
        .eq('user_id', userId)
        .in('episode_id', airedIds)
      if (error) throw error
      for (const id of airedIds) watched.delete(id)
    }
  }

  async function loadProgress(): Promise<void> {
    const { data, error } = await supabase.rpc('my_show_progress')
    if (error) throw error
    progress.value = new Map(((data ?? []) as ShowProgress[]).map((p) => [p.show_id, p]))
  }

  function reset(): void {
    watched.clear()
    loadedShows.clear()
    progress.value = new Map()
  }

  return {
    watched,
    loadedShows,
    progress,
    loadForEpisodes,
    isWatched,
    toggle,
    setSeason,
    loadProgress,
    reset,
  }
})
