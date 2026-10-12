import { computed } from 'vue'

import { useQueryParam } from '@/composables/useQueryParam'
import { channelLabel, plural } from '@/lib/format'
import { fuzzyFilter } from '@/lib/fuzzy'
import { useLibraryStore } from '@/stores/library'
import { useUpcomingStore } from '@/stores/upcoming'
import {
  USER_SHOW_STATUSES,
  type LibraryEntry,
  type UpcomingEpisode,
  type UserShowStatus,
} from '@/types/domain'

export type LibraryFilter = UserShowStatus | 'all'
export type LibrarySort = 'next' | 'rating' | 'az' | 'added'
export type LibraryView = 'grid' | 'table'

/**
 * Status / network / text filters, the sort and the grid-or-table switch for the Library.
 * They live in the URL so a refresh or the back button lands on the same view.
 */
export function useLibraryFilters() {
  const library = useLibraryStore()
  const upcoming = useUpcomingStore()

  const filter = useQueryParam<LibraryFilter>('status', {
    defaultValue: 'all',
    parse: (r) =>
      r === 'all' || USER_SHOW_STATUSES.some((s) => s.value === r)
        ? (r as LibraryFilter)
        : undefined,
  })
  const sort = useQueryParam<LibrarySort>('sort', {
    defaultValue: 'next',
    parse: (r) => (['next', 'rating', 'az', 'added'] as const).find((v) => v === r),
  })
  const view = useQueryParam<LibraryView>('view', {
    defaultValue: 'grid',
    parse: (r) => (r === 'grid' || r === 'table' ? r : undefined),
    remember: 'airtime:library-view',
  })
  const query = useQueryParam<string>('find', { defaultValue: '', parse: (r) => r })
  const network = useQueryParam<string>('network', { defaultValue: 'all', parse: (r) => r })

  /** The next episode per followed show, from the 30-day feed that includes muted/dropped. */
  const nextByShow = computed(() => {
    const map = new Map<number, UpcomingEpisode>()
    for (const e of upcoming.items('all', 30)) if (!map.has(e.show_id)) map.set(e.show_id, e)
    return map
  })

  const filters = computed(() => [
    { value: 'all' as LibraryFilter, label: 'All', count: library.counts.all },
    ...USER_SHOW_STATUSES.map((s) => ({
      value: s.value as LibraryFilter,
      label: s.label,
      count: library.counts[s.value],
    })),
  ])

  /** Channels present in the user's library, most common first. */
  const networkOptions = computed(() => {
    const counts = new Map<string, number>()
    for (const e of library.entries) {
      const label = channelLabel(e.show)
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [
      { value: 'all', label: 'All networks' },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, n]) => ({ value: name, label: `${name} (${n})` })),
    ]
  })

  const searching = computed(() => query.value.trim().length > 0)

  const nextTime = (e: LibraryEntry) => {
    const n = nextByShow.value.get(e.show_id)
    return n ? new Date(n.airstamp).getTime() : Number.POSITIVE_INFINITY
  }
  const scoped = computed(() =>
    library.entries.filter(
      (e) =>
        (filter.value === 'all' || e.status === filter.value) &&
        (network.value === 'all' || channelLabel(e.show) === network.value),
    ),
  )
  const entries = computed(() => {
    // While searching, relevance order wins over the chosen sort.
    if (searching.value) return fuzzyFilter(scoped.value, query.value, (e) => e.show.name)
    return [...scoped.value].sort((a, b) => {
      switch (sort.value) {
        case 'rating':
          return (b.rating ?? 0) - (a.rating ?? 0) || a.show.name.localeCompare(b.show.name)
        case 'az':
          return a.show.name.localeCompare(b.show.name)
        case 'added':
          return b.added_at.localeCompare(a.added_at)
        default:
          return nextTime(a) - nextTime(b) || a.show.name.localeCompare(b.show.name)
      }
    })
  })

  const subtitle = computed(() => {
    const rated = library.entries.filter((e) => e.rating).length
    const parts = [plural(library.counts.all, 'show'), `${rated} rated`]
    if (searching.value) parts.push(plural(entries.value.length, 'match', 'matches'))
    return parts.join(' · ')
  })

  return {
    filter,
    sort,
    view,
    query,
    network,
    filters,
    networkOptions,
    searching,
    entries,
    nextByShow,
    subtitle,
  }
}
