import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { refreshShow } from '@/lib/api/shows'
import { supabase } from '@/lib/supabase'
import { useUpcomingStore } from '@/stores/upcoming'
import type { LibraryEntry, UserShow, UserShowStatus } from '@/types/domain'

const LIBRARY_SELECT =
  'user_id, show_id, status, rating, notes, notify, added_at, updated_at, show:shows(id, tvmaze_id, name, status, image_medium, genres, premiered, type, network:channels!shows_network_id_fkey(name, country_code), web_channel:channels!shows_web_channel_id_fkey(name))'

/** The signed-in user's tracked shows, cached for fast "is tracked?" lookups. */
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('not signed in')
  return id
}

export const useLibraryStore = defineStore('library', () => {
  const entries = ref<LibraryEntry[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  const byShowId = computed(() => new Map(entries.value.map((e) => [e.show_id, e])))
  const counts = computed(() => {
    const c: Record<UserShowStatus | 'all', number> = {
      all: entries.value.length,
      watching: 0,
      completed: 0,
      dropped: 0,
      plan_to_watch: 0,
    }
    for (const e of entries.value) c[e.status]++
    return c
  })

  async function load(force = false): Promise<void> {
    if ((loaded.value && !force) || loading.value) return
    loading.value = true
    try {
      // Always scope to the signed-in user: admins can read other users' rows
      // through RLS (for follower counts), so RLS alone is not a filter here.
      const userId = await currentUserId()
      const { data, error } = await supabase
        .from('user_shows')
        .select(LIBRARY_SELECT)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      entries.value = (data ?? []) as unknown as LibraryEntry[]
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function entryFor(showId: number): LibraryEntry | undefined {
    return byShowId.value.get(showId)
  }

  async function track(
    showId: number,
    tvmazeId?: number,
    status: UserShowStatus = 'watching',
  ): Promise<void> {
    const userId = await currentUserId()
    const { data, error } = await supabase
      .from('user_shows')
      .upsert({ user_id: userId, show_id: showId, status }, { onConflict: 'user_id,show_id' })
      .select(LIBRARY_SELECT)
      .single()
    if (error) throw error
    upsertLocal(data as unknown as LibraryEntry)

    // Pull the full episode list right away; the queue is the fallback if this fails.
    const id = tvmazeId ?? (data as unknown as LibraryEntry).show?.tvmaze_id
    if (id) refreshShow(id).catch((err) => console.warn('refresh-show failed, queue will handle it', err))
  }

  /**
   * Save changes to a tracked show. Implemented as an upsert so a stale tab (or a
   * show that was untracked elsewhere) never fails with "0 rows": the row is
   * recreated with the given fields and defaults for the rest.
   */
  async function update(
    showId: number,
    patch: Partial<Pick<UserShow, 'status' | 'rating' | 'notes' | 'notify'>>,
    tvmazeId?: number,
  ): Promise<void> {
    const userId = await currentUserId()
    const existed = byShowId.value.has(showId)
    const { data, error } = await supabase
      .from('user_shows')
      .upsert({ user_id: userId, show_id: showId, ...patch }, { onConflict: 'user_id,show_id' })
      .select(LIBRARY_SELECT)
      .single()
    if (error) throw error
    const entry = data as unknown as LibraryEntry
    upsertLocal(entry)

    // The row was (re)created: make sure its episode list gets fetched.
    if (!existed && (tvmazeId ?? entry.show?.tvmaze_id)) {
      refreshShow(tvmazeId ?? entry.show.tvmaze_id).catch((err) =>
        console.warn('refresh-show failed, queue will handle it', err),
      )
    }
  }

  async function untrack(showId: number): Promise<void> {
    const userId = await currentUserId()
    const { error } = await supabase
      .from('user_shows')
      .delete()
      .eq('user_id', userId)
      .eq('show_id', showId)
    if (error) throw error
    entries.value = entries.value.filter((e) => e.show_id !== showId)
    useUpcomingStore().invalidate()
  }

  function upsertLocal(entry: LibraryEntry): void {
    useUpcomingStore().invalidate()
    const idx = entries.value.findIndex((e) => e.show_id === entry.show_id)
    if (idx === -1) entries.value = [entry, ...entries.value]
    else entries.value.splice(idx, 1, entry)
  }

  function reset(): void {
    entries.value = []
    loaded.value = false
  }

  return {
    entries,
    loaded,
    loading,
    counts,
    byShowId,
    load,
    entryFor,
    track,
    update,
    untrack,
    reset,
  }
})
