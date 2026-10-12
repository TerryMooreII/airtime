<script setup lang="ts">
import { computed, onMounted } from 'vue'

import {
  AButton,
  AChoiceGroup,
  AEmptyState,
  AHeader,
  ASearchBox,
  ASelect,
  AShowCard,
  AShowGrid,
  ASkeleton,
} from '@/design-system'
import { useLibraryActions } from '@/composables/useLibraryActions'
import { episodeCode, formatAirTime, joinMeta, shortDayLabel, STATUS_LABELS } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useUpcomingStore } from '@/stores/upcoming'
import { useWatchedStore } from '@/stores/watched'
import type { LibraryEntry, UserShowStatus } from '@/types/domain'

import LibraryTable from './LibraryTable.vue'
import { useLibraryFilters } from './useLibraryFilters'

const auth = useAuthStore()
const library = useLibraryStore()
const actions = useLibraryActions()
const watched = useWatchedStore()
const upcoming = useUpcomingStore()
const {
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
} = useLibraryFilters()
const tz = computed(() => auth.timezone)

onMounted(() => {
  // Three independent requests; the progress and next-air data only decorate the rows.
  void library.load()
  void watched.loadProgress().catch(() => undefined)
  void upcoming.load('all', 30).catch(() => undefined)
})

/** Card badge: when the next episode airs. */
function badge(e: LibraryEntry): string | undefined {
  const n = nextByShow.value.get(e.show_id)
  return n
    ? `${shortDayLabel(n.airstamp, tz.value)} ${formatAirTime(n.airstamp, tz.value)}`
    : undefined
}
/** Card meta: status, next episode code (or the show's status), unwatched count. */
function meta(e: LibraryEntry): string {
  const n = nextByShow.value.get(e.show_id)
  const p = watched.progress.get(e.show_id)
  const left = p ? Math.max(0, p.aired - p.watched) : 0
  return joinMeta(
    STATUS_LABELS[e.status],
    n ? episodeCode(n.season, n.number) : (e.show.status ?? '—'),
    left ? `${left} unwatched` : null,
  )
}
const showRef = (e: LibraryEntry) => ({ id: e.show_id, tvmaze_id: e.show.tvmaze_id })
const rate = (e: LibraryEntry, rating: number | null) => actions.rate(showRef(e), rating)
const setStatus = (e: LibraryEntry, status: UserShowStatus) => actions.setStatus(showRef(e), status)
</script>

<template>
  <div class="page library">
    <AHeader title="Library" :subtitle="subtitle">
      <AChoiceGroup
        v-model="sort"
        variant="segmented"
        :options="[
          { value: 'next', label: 'Airing next' },
          { value: 'rating', label: 'Rating' },
          { value: 'az', label: 'A–Z' },
          { value: 'added', label: 'Recent' },
        ]"
        aria-label="Sort"
      />
      <AChoiceGroup
        v-model="view"
        variant="segmented"
        :options="[
          { value: 'grid', label: 'Grid' },
          { value: 'table', label: 'Table' },
        ]"
        aria-label="View"
      />
    </AHeader>

    <div class="library__tools">
      <AChoiceGroup
        v-model="filter"
        variant="pills"
        :options="filters"
        aria-label="Status filter"
        class="library__filters"
      />
      <div class="library__right">
        <ASelect
          v-if="networkOptions.length > 2"
          v-model="network"
          :options="networkOptions"
          aria-label="Network"
          class="library__network"
        />
        <ASearchBox v-model="query" placeholder="Filter your shows" class="library__search" />
      </div>
    </div>

    <AShowGrid v-if="library.loading && !library.loaded">
      <ASkeleton v-for="i in 8" :key="i" ratio="2 / 3" />
    </AShowGrid>

    <template v-else-if="entries.length">
      <AShowGrid v-if="view === 'grid'">
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
          :show-follow="false"
          @update:rating="rate(e, $event)"
        />
      </AShowGrid>
      <LibraryTable
        v-else
        :entries="entries"
        :next-by-show="nextByShow"
        :progress="watched.progress"
        :tz="tz"
        @rate="rate"
        @set-status="setStatus"
      />
    </template>

    <AEmptyState
      v-else-if="searching"
      title="No shows match"
      :description="`Nothing in your library matches “${query.trim()}”.`"
      compact
    >
      <AButton variant="outline" size="sm" @click="query = ''">Clear search</AButton>
    </AEmptyState>

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
.library__tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: -8px;
}
.library__filters {
  min-width: 0;
}
.library__right {
  display: flex;
  gap: var(--space-2);
  flex-wrap: nowrap;
  align-items: center;
}
/* Fixed width so long network names never widen the toolbar; the select truncates. */
.library__network {
  width: 190px;
  flex: none;
}
.library__search {
  width: 260px;
  flex: none;
}
@media (max-width: 759px) {
  .library__right {
    width: 100%;
    min-width: 0;
  }
  .library__network {
    flex: 0 1 44%;
    width: auto;
    min-width: 0;
  }
  .library__search {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
  }
}
</style>
