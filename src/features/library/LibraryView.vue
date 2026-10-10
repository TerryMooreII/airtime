<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  AButton,
  AEmptyState,
  APageHeader,
  APills,
  ASegmented,
  AShowCard,
  ASkeleton,
} from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { fetchUpcomingEpisodes } from '@/lib/api/episodes'
import { episodeCode, formatAirTime, shortDayLabel, STATUS_LABELS } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import {
  USER_SHOW_STATUSES,
  type LibraryEntry,
  type UpcomingEpisode,
  type UserShowStatus,
} from '@/types/domain'

type Filter = UserShowStatus | 'all'
type Sort = 'next' | 'rating' | 'az' | 'added'

const auth = useAuthStore()
const library = useLibraryStore()
const ui = useUiStore()

const filter = ref<Filter>('all')
const sort = ref<Sort>('next')
const nextByShow = ref(new Map<number, UpcomingEpisode>())

onMounted(async () => {
  await library.load()
  try {
    const eps = await fetchUpcomingEpisodes(30, 500)
    const map = new Map<number, UpcomingEpisode>()
    for (const e of eps) if (!map.has(e.show_id)) map.set(e.show_id, e)
    nextByShow.value = map
  } catch {
    /* next-episode badges are optional */
  }
})

const filters = computed(() => [
  { value: 'all' as Filter, label: 'All', count: library.counts.all },
  ...USER_SHOW_STATUSES.map((s) => ({
    value: s.value as Filter,
    label: s.label,
    count: library.counts[s.value],
  })),
])

const entries = computed(() => {
  const list = library.entries.filter(
    (e) =>
      (filter.value === 'all' || e.status === filter.value) &&
      // An ended show cannot air next; keep it out of that view.
      (sort.value !== 'next' || e.show.status !== 'Ended'),
  )
  const nextTime = (e: LibraryEntry) => {
    const n = nextByShow.value.get(e.show_id)
    return n ? new Date(n.airstamp).getTime() : Number.POSITIVE_INFINITY
  }
  return [...list].sort((a, b) => {
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

const rated = computed(() => library.entries.filter((e) => e.rating).length)
const hiddenEnded = computed(() =>
  sort.value === 'next'
    ? library.entries.filter(
        (e) => (filter.value === 'all' || e.status === filter.value) && e.show.status === 'Ended',
      ).length
    : 0,
)

function badge(e: LibraryEntry): string | undefined {
  const n = nextByShow.value.get(e.show_id)
  if (!n) return undefined
  return `${shortDayLabel(n.airstamp, auth.timezone)} ${formatAirTime(n.airstamp, auth.timezone)}`
}
function meta(e: LibraryEntry): string {
  const n = nextByShow.value.get(e.show_id)
  return `${STATUS_LABELS[e.status]} · ${n ? episodeCode(n.season, n.number) : (e.show.status ?? '—')}`
}
async function rate(e: LibraryEntry, rating: number | null) {
  try {
    await library.update(e.show_id, { rating }, e.show.tvmaze_id)
  } catch (err) {
    ui.error(errorMessage(err))
  }
}
async function unfollow(e: LibraryEntry) {
  try {
    await library.untrack(e.show_id)
    ui.toast(`Removed ${e.show.name}`)
  } catch (err) {
    ui.error(errorMessage(err))
  }
}
</script>

<template>
  <div class="library">
    <APageHeader
      title="Library"
      :subtitle="`${library.counts.all} show${library.counts.all === 1 ? '' : 's'} · ${rated} rated${hiddenEnded ? ` · ${hiddenEnded} ended show${hiddenEnded === 1 ? '' : 's'} hidden in this view` : ''}`"
    >
      <AButton variant="outline" size="sm" icon="plus" :to="{ name: 'import' }">Import CSV</AButton>
      <ASegmented
        v-model="sort"
        :options="[
          { value: 'next', label: 'Airing next' },
          { value: 'rating', label: 'Rating' },
          { value: 'az', label: 'A–Z' },
          { value: 'added', label: 'Recent' },
        ]"
        aria-label="Sort"
      />
    </APageHeader>

    <APills
      v-model="filter"
      :options="filters"
      aria-label="Status filter"
      class="library__filters"
    />

    <div v-if="library.loading && !library.loaded" class="grid">
      <ASkeleton v-for="i in 8" :key="i" ratio="2 / 3" />
    </div>

    <div v-else-if="entries.length" class="grid">
      <AShowCard
        v-for="e in entries"
        :key="e.show_id"
        :show-id="e.show_id"
        :name="e.show.name"
        :image="e.show.image_medium"
        :badge="badge(e)"
        :meta="meta(e)"
        :rating="e.rating"
        show-rating
        following
        @update:rating="rate(e, $event)"
        @follow="unfollow(e)"
      />
    </div>

    <AEmptyState
      v-else
      :title="filter === 'all' ? 'Your library is empty' : 'No shows here yet'"
      :description="
        filter === 'all'
          ? 'Search for the shows you watch and follow them to build your guide.'
          : 'Change a show\'s status from its page to see it here.'
      "
    >
      <AButton v-if="filter === 'all'" :to="{ name: 'search' }" icon="search">Find shows</AButton>
      <AButton v-if="filter === 'all'" variant="outline" :to="{ name: 'import' }" icon="plus"
        >Import a CSV</AButton
      >
    </AEmptyState>
  </div>
</template>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.library__filters {
  margin-top: -8px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
  gap: var(--grid-gap);
}
@media (max-width: 759px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(var(--card-min-mobile), 1fr));
    gap: var(--grid-gap-mobile);
  }
}
</style>
