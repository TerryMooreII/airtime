import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { deleteUserShow, fetchLibrary, upsertUserShow } from '@/lib/api/library'
import { requireUserId } from '@/lib/api/session'
import { refreshShow } from '@/lib/api/shows'
import { useUpcomingStore } from '@/stores/upcoming'
import {
  USER_SHOW_STATUSES,
  type LibraryEntry,
  type UserShow,
  type UserShowStatus,
} from '@/types/domain'

/** The signed-in user's tracked shows, cached for fast "is tracked?" lookups. */
export const useLibraryStore = defineStore('library', () => {
  const entries = ref<LibraryEntry[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  const byShowId = computed(() => new Map(entries.value.map((e) => [e.show_id, e])))
  const counts = computed(() => {
    const c = Object.fromEntries(USER_SHOW_STATUSES.map((s) => [s.value, 0])) as Record<
      UserShowStatus,
      number
    >
    for (const e of entries.value) c[e.status]++
    return { all: entries.value.length, ...c }
  })

  async function load(force = false): Promise<void> {
    if ((loaded.value && !force) || loading.value) return
    loading.value = true
    try {
      entries.value = await fetchLibrary(requireUserId())
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function entryFor(showId: number): LibraryEntry | undefined {
    return byShowId.value.get(showId)
  }

  /** Kick off the instant episode import; the queue is the fallback if it fails. */
  function importEpisodes(tvmazeId: number | undefined): void {
    if (tvmazeId)
      refreshShow(tvmazeId).catch((err) =>
        console.warn('refresh-show failed, queue will handle it', err),
      )
  }

  async function track(
    showId: number,
    tvmazeId?: number,
    status: UserShowStatus = 'watching',
  ): Promise<void> {
    const entry = await upsertUserShow({ user_id: requireUserId(), show_id: showId, status })
    upsertLocal(entry)
    useUpcomingStore().onLibraryChange(showId, { followed: true, status: entry.status })
    importEpisodes(tvmazeId ?? entry.show?.tvmaze_id)
  }

  /**
   * Save changes to a tracked show. An upsert, so a stale tab (or a show that was untracked
   * elsewhere) recreates the row instead of failing with "0 rows". Only status and notify
   * changes affect the upcoming feeds; ratings and notes never trigger a refetch.
   */
  async function update(
    showId: number,
    patch: Partial<Pick<UserShow, 'status' | 'rating' | 'notes' | 'notify'>>,
    tvmazeId?: number,
  ): Promise<void> {
    const existed = byShowId.value.has(showId)
    const entry = await upsertUserShow({ user_id: requireUserId(), show_id: showId, ...patch })
    upsertLocal(entry)
    if (!existed || patch.status !== undefined || patch.notify !== undefined)
      useUpcomingStore().onLibraryChange(showId, { followed: true, status: entry.status })
    if (!existed) importEpisodes(tvmazeId ?? entry.show?.tvmaze_id)
  }

  async function untrack(showId: number): Promise<void> {
    await deleteUserShow(requireUserId(), showId)
    entries.value = entries.value.filter((e) => e.show_id !== showId)
    useUpcomingStore().onLibraryChange(showId, { followed: false, status: null })
  }

  function upsertLocal(entry: LibraryEntry): void {
    const idx = entries.value.findIndex((e) => e.show_id === entry.show_id)
    if (idx === -1) entries.value = [entry, ...entries.value]
    else entries.value.splice(idx, 1, entry)
  }

  /** Merge rows returned by a bulk upsert (CSV import) without reloading the library. */
  function mergeEntries(list: LibraryEntry[]): void {
    for (const entry of list) upsertLocal(entry)
    useUpcomingStore().invalidate()
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
    mergeEntries,
    reset,
  }
})
