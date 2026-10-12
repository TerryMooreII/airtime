<script setup lang="ts">
import { computed, onMounted } from 'vue'

import {
  ABadge,
  AButton,
  AChoiceGroup,
  AEmptyState,
  AHeader,
  AProgressBar,
  ASearchBox,
  ASelect,
  AShowCard,
  ASkeleton,
  AStarRating,
  ATable,
  type TableColumn,
} from '@/design-system'
import { useLibraryActions } from '@/composables/useLibraryActions'
import { useQueryParam } from '@/composables/useQueryParam'
import {
  channelLabel,
  episodeCode,
  formatAirTime,
  joinMeta,
  plural,
  shortDayLabel,
  STATUS_LABELS,
  timeAgo,
  yearOf,
} from '@/lib/format'
import { fuzzyFilter } from '@/lib/fuzzy'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useUpcomingStore } from '@/stores/upcoming'
import { useWatchedStore } from '@/stores/watched'
import {
  USER_SHOW_STATUSES,
  type LibraryEntry,
  type UpcomingEpisode,
  type UserShowStatus,
} from '@/types/domain'

type Filter = UserShowStatus | 'all'
type Sort = 'next' | 'rating' | 'az' | 'added'
type View = 'grid' | 'table'

const auth = useAuthStore()
const library = useLibraryStore()
const actions = useLibraryActions()
const watched = useWatchedStore()
const upcoming = useUpcomingStore()

// Filters live in the URL so a refresh or the back button lands on the same view.
const filter = useQueryParam<Filter>('status', {
  defaultValue: 'all',
  parse: (r) =>
    r === 'all' || USER_SHOW_STATUSES.some((s) => s.value === r) ? (r as Filter) : undefined,
})
const sort = useQueryParam<Sort>('sort', {
  defaultValue: 'next',
  parse: (r) => (['next', 'rating', 'az', 'added'] as const).find((v) => v === r),
})
const view = useQueryParam<View>('view', {
  defaultValue: 'grid',
  parse: (r) => (r === 'grid' || r === 'table' ? r : undefined),
  remember: 'airtime:library-view',
})
const query = useQueryParam<string>('find', { defaultValue: '', parse: (r) => r })
const nextByShow = computed(() => {
  const map = new Map<number, UpcomingEpisode>()
  for (const e of upcoming.items('all', 30)) if (!map.has(e.show_id)) map.set(e.show_id, e)
  return map
})

onMounted(() => {
  // Three independent requests; the progress and next-air data only decorate the rows.
  void library.load()
  void watched.loadProgress().catch(() => undefined)
  void upcoming.load('all', 30).catch(() => undefined)
})

const filters = computed(() => [
  { value: 'all' as Filter, label: 'All', count: library.counts.all },
  ...USER_SHOW_STATUSES.map((s) => ({
    value: s.value as Filter,
    label: s.label,
    count: library.counts[s.value],
  })),
])

const nextTime = (e: LibraryEntry) => {
  const n = nextByShow.value.get(e.show_id)
  return n ? new Date(n.airstamp).getTime() : Number.POSITIVE_INFINITY
}

const searching = computed(() => query.value.trim().length > 0)

/** Status filter only; sorting never adds or removes shows. */
const network = useQueryParam<string>('network', { defaultValue: 'all', parse: (r) => r })
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

const rated = computed(() => library.entries.filter((e) => e.rating).length)
const subtitle = computed(() => {
  const parts = [plural(library.counts.all, 'show'), `${rated.value} rated`]
  if (searching.value) parts.push(plural(entries.value.length, 'match', 'matches'))
  return parts.join(' · ')
})

function next(e: LibraryEntry): UpcomingEpisode | undefined {
  return nextByShow.value.get(e.show_id)
}
function badge(e: LibraryEntry): string | undefined {
  const n = next(e)
  return n
    ? `${shortDayLabel(n.airstamp, auth.timezone)} ${formatAirTime(n.airstamp, auth.timezone)}`
    : undefined
}
function unwatched(e: LibraryEntry): number {
  const p = watched.progress.get(e.show_id)
  return p ? Math.max(0, p.aired - p.watched) : 0
}
function meta(e: LibraryEntry): string {
  const n = next(e)
  const left = unwatched(e)
  return joinMeta(
    STATUS_LABELS[e.status],
    n ? episodeCode(n.season, n.number) : (e.show.status ?? '—'),
    left ? `${left} unwatched` : null,
  )
}
function showMeta(e: LibraryEntry): string {
  return joinMeta(yearOf(e.show.premiered), channelLabel(e.show))
}
const showRef = (e: LibraryEntry) => ({ id: e.show_id, tvmaze_id: e.show.tvmaze_id })
const rate = (e: LibraryEntry, rating: number | null) => actions.rate(showRef(e), rating)
const setStatus = (e: LibraryEntry, status: UserShowStatus) => actions.setStatus(showRef(e), status)

const columns: TableColumn[] = [
  { key: 'show', label: 'Show' },
  { key: 'status', label: 'My status' },
  { key: 'rating', label: 'Rating' },
  { key: 'progress', label: 'Progress' },
  { key: 'next', label: 'Next episode' },
  { key: 'show_status', label: 'Show' },
  { key: 'added_at', label: 'Added' },
]
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

      <ATable v-else :columns="columns" :rows="entries" row-key="show_id" class="table">
        <template #cell-show="{ row }">
          <AMediaRow
            :to="{ name: 'show', params: { id: row.show_id } }"
            :image="row.show.image_medium"
            :image-width="36"
            :title="row.show.name"
            :subtitle="showMeta(row)"
            class="show-cell"
          />
        </template>
        <template #cell-status="{ row }">
          <ASelect
            :model-value="row.status"
            :options="USER_SHOW_STATUSES"
            :aria-label="`Status for ${row.show.name}`"
            class="status-select"
            @update:model-value="setStatus(row, $event as UserShowStatus)"
          />
        </template>
        <template #cell-rating="{ row }">
          <AStarRating
            :model-value="row.rating"
            size="sm"
            @update:model-value="rate(row, $event)"
          />
        </template>
        <template #cell-progress="{ row }">
          <span v-if="watched.progress.get(row.show_id)?.aired" class="progress-cell">
            <AProgressBar
              :value="watched.progress.get(row.show_id)!.watched"
              :max="watched.progress.get(row.show_id)!.aired"
              label="Watched"
            />
            <span class="t-muted t-mono progress-cell__label"
              >{{ watched.progress.get(row.show_id)!.watched }} /
              {{ watched.progress.get(row.show_id)!.aired }}</span
            >
          </span>
          <span v-else class="t-muted">—</span>
        </template>
        <template #cell-next="{ row }">
          <span v-if="next(row)" class="stack-tight next-cell">
            <span class="next-cell__when">{{ badge(row) }}</span>
            <span class="t-muted t-mono next-cell__code">{{
              episodeCode(next(row)!.season, next(row)!.number)
            }}</span>
          </span>
          <span v-else class="t-muted">—</span>
        </template>
        <template #cell-show_status="{ row }">
          <ABadge :variant="row.show.status === 'Running' ? 'success' : 'muted'">{{
            row.show.status ?? '—'
          }}</ABadge>
        </template>
        <template #cell-added_at="{ row }"
          ><span class="t-muted">{{ timeAgo(row.added_at) }}</span></template
        >
      </ATable>
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
.library__network :deep(select) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.library__search {
  width: 260px;
  flex: none;
}

.show-cell {
  min-width: 220px;
}

.status-select {
  min-width: 150px;
}

.progress-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 110px;
}
.progress-cell__label {
  font-size: var(--text-2xs);
}
.next-cell__when {
  font: 600 var(--text-xs) var(--font-mono);
  color: var(--primary-text);
  white-space: nowrap;
}
.next-cell__code {
  font-size: var(--text-2xs);
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
