import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { invokeFunction, supabase } from '@/lib/supabase'
import type { LibraryEntry, UserShow, UserShowStatus } from '@/types/domain'

const LIBRARY_SELECT =
  'user_id, show_id, status, rating, notes, notify, added_at, updated_at, show:shows(id, tvmaze_id, name, status, image_medium, genres, premiered, type)'

/** The signed-in user's tracked shows, cached for fast "is tracked?" lookups. */
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
      const { data, error } = await supabase
        .from('user_shows')
        .select(LIBRARY_SELECT)
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
    tvmazeId: number,
    status: UserShowStatus = 'watching',
  ): Promise<void> {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('not signed in')

    const { data, error } = await supabase
      .from('user_shows')
      .upsert({ user_id: userId, show_id: showId, status }, { onConflict: 'user_id,show_id' })
      .select(LIBRARY_SELECT)
      .single()
    if (error) throw error
    upsertLocal(data as unknown as LibraryEntry)

    // Pull the full episode list right away; the queue is the fallback if this fails.
    invokeFunction('refresh-show', { tvmaze_id: tvmazeId }).catch((err) =>
      console.warn('refresh-show failed, queue will handle it', err),
    )
  }

  async function update(
    showId: number,
    patch: Partial<Pick<UserShow, 'status' | 'rating' | 'notes' | 'notify'>>,
  ): Promise<void> {
    const { data, error } = await supabase
      .from('user_shows')
      .update(patch)
      .eq('show_id', showId)
      .select(LIBRARY_SELECT)
      .single()
    if (error) throw error
    upsertLocal(data as unknown as LibraryEntry)
  }

  async function untrack(showId: number): Promise<void> {
    const { error } = await supabase.from('user_shows').delete().eq('show_id', showId)
    if (error) throw error
    entries.value = entries.value.filter((e) => e.show_id !== showId)
  }

  function upsertLocal(entry: LibraryEntry): void {
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
