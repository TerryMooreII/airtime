import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'

import { fetchUpcomingEpisodes, fetchUpcomingEpisodesAll } from '@/lib/api/episodes'
import type { UpcomingEpisode } from '@/types/domain'

/**
 * One cached copy of the upcoming-episode feeds, shared by the sidebar rail, the
 * Guide and the Library. Each feed is fetched once per session (5 minute TTL),
 * in-flight requests are de-duplicated, and library changes refresh it.
 */
export type UpcomingScope = 'mine' | 'all' | 'everything'

interface Feed {
  items: UpcomingEpisode[]
  loadedAt: number
  days: number
  promise: Promise<UpcomingEpisode[]> | null
}

const TTL_MS = 5 * 60_000
const MINE_DAYS = 30 // one fetch covers every range the UI offers

export const useUpcomingStore = defineStore('upcoming', () => {
  const feeds = reactive(new Map<UpcomingScope, Feed>())

  function key(scope: UpcomingScope, days: number): number {
    return scope === 'everything' ? days : MINE_DAYS
  }

  async function fetchFeed(scope: UpcomingScope, days: number): Promise<UpcomingEpisode[]> {
    if (scope === 'everything') return fetchUpcomingEpisodesAll(days, 1000)
    return fetchUpcomingEpisodes(MINE_DAYS, 500, scope === 'all')
  }

  /** Ensure the feed is loaded (fresh enough) and return it, trimmed to `days`. */
  async function load(
    scope: UpcomingScope,
    days: number,
    force = false,
  ): Promise<UpcomingEpisode[]> {
    const wantDays = key(scope, days)
    const current = feeds.get(scope)
    const fresh = current && current.days >= wantDays && Date.now() - current.loadedAt < TTL_MS
    if (current?.promise) await current.promise
    else if (!fresh || force) {
      // Mutate the reactive proxy, not the plain object: the Map stores the raw object and
      // hands out a proxy, so writes to the raw object would never notify computeds.
      const feed = reactive<Feed>({
        items: current?.items ?? [],
        loadedAt: current?.loadedAt ?? 0,
        days: wantDays,
        promise: null,
      }) as Feed
      feed.promise = fetchFeed(scope, wantDays)
      feeds.set(scope, feed)
      try {
        feed.items = await feed.promise
        feed.loadedAt = Date.now()
      } finally {
        feed.promise = null
      }
    }
    return items(scope, days)
  }

  /** Reactive view of a feed trimmed to the next `days` days. */
  function items(scope: UpcomingScope, days: number): UpcomingEpisode[] {
    const feed = feeds.get(scope)
    if (!feed) return []
    const horizon = Date.now() + days * 86_400_000
    return feed.items.filter((e) => new Date(e.airstamp).getTime() < horizon)
  }

  function isLoading(scope: UpcomingScope): boolean {
    return !!feeds.get(scope)?.promise
  }

  /** Library changed (follow, unfollow, status): refetch every feed already in use. */
  function invalidate(): void {
    for (const [scope, feed] of feeds) if (!feed.promise) void load(scope, feed.days, true)
  }

  function reset(): void {
    feeds.clear()
  }

  const mineSoon = computed(() => items('mine', 7))

  return { feeds, load, items, isLoading, invalidate, reset, mineSoon }
})
