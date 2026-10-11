<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import {
  ABadge,
  ASelect,
  AProgressBar,
  AButton,
  AEmptyState,
  APageHeader,
  APills,
  APoster,
  ASearchBox,
  ASegmented,
  AShowCard,
  ASkeleton,
  AStarRating,
  ATable,
  type TableColumn,
} from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import {
  episodeCode,
  formatAirTime,
  shortDayLabel,
  STATUS_LABELS,
  timeAgo,
  yearOf,
  channelLabel,
} from '@/lib/format'
import { fuzzyFilter } from '@/lib/fuzzy'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
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

const VIEW_KEY = 'airtime:library-view'

const auth = useAuthStore()
const library = useLibraryStore()
const ui = useUiStore()
const watched = useWatchedStore()
const upcoming = useUpcomingStore()

const filter = ref<Filter>('all')
const sort = ref<Sort>('next')
const view = ref<View>(readView())
const query = ref('')
const nextByShow = computed(() => {
  const map = new Map<number, UpcomingEpisode>()
  for (const e of upcoming.items('all', 30)) if (!map.has(e.show_id)) map.set(e.show_id, e)
  return map
})

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'grid'
  } catch {
    return 'grid'
  }
}
watch(view, (v) => {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    /* ignore */
  }
})

onMounted(async () => {
  await library.load()
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
const network = ref<string>('all')
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
  const parts = [
    `${library.counts.all} show${library.counts.all === 1 ? '' : 's'}`,
    `${rated.value} rated`,
  ]
  if (searching.value)
    parts.push(`${entries.value.length} match${entries.value.length === 1 ? '' : 'es'}`)
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
  return [
    STATUS_LABELS[e.status],
    n ? episodeCode(n.season, n.number) : (e.show.status ?? '—'),
    left ? `${left} unwatched` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
function showMeta(e: LibraryEntry): string {
  return [yearOf(e.show.premiered), channelLabel(e.show)].filter(Boolean).join(' · ')
}
async function rate(e: LibraryEntry, rating: number | null) {
  try {
    await library.update(e.show_id, { rating }, e.show.tvmaze_id)
  } catch (err) {
    ui.error(errorMessage(err))
  }
}
async function setStatus(e: LibraryEntry, status: UserShowStatus) {
  try {
    await library.update(e.show_id, { status }, e.show.tvmaze_id)
  } catch (err) {
    ui.error(errorMessage(err))
  }
}

const columns: TableColumn[] = [
  { key: 'show', label: 'Show' },
  { key: 'status', label: 'My status' },
  { key: 'rating', label: 'Rating' },
  { key: 'progress', label: 'Progress' },
  { key: 'next', label: 'Next episode' },
  { key: 'show_status', label: 'Show' },
  { key: 'added_at', label: 'Added' },
]
const tableRows = computed(() => entries.value.map((e) => ({ id: e.show_id, entry: e })))
const statusOptions = USER_SHOW_STATUSES.map((s) => ({ value: s.value, label: s.label }))
</script>

<template>
  <div class="library">
    <APageHeader title="Library" :subtitle="subtitle">
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
      <ASegmented
        v-model="view"
        :options="[
          { value: 'grid', label: 'Grid' },
          { value: 'table', label: 'Table' },
        ]"
        aria-label="View"
      />
    </APageHeader>

    <div class="library__tools">
      <APills
        v-model="filter"
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

    <div v-if="library.loading && !library.loaded" class="grid">
      <ASkeleton v-for="i in 8" :key="i" ratio="2 / 3" />
    </div>

    <template v-else-if="entries.length">
      <div v-if="view === 'grid'" class="grid">
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
      </div>

      <ATable v-else :columns="columns" :rows="tableRows" class="table">
        <template #cell-show="{ row }">
          <RouterLink
            :to="{ name: 'show', params: { id: (row.entry as LibraryEntry).show_id } }"
            class="show-cell"
          >
            <APoster
              :src="(row.entry as LibraryEntry).show.image_medium"
              radius="sm"
              class="show-cell__img"
            />
            <span class="show-cell__text">
              <span class="show-cell__name truncate">{{
                (row.entry as LibraryEntry).show.name
              }}</span>
              <span class="show-cell__meta truncate">{{
                showMeta(row.entry as LibraryEntry)
              }}</span>
            </span>
          </RouterLink>
        </template>
        <template #cell-status="{ row }">
          <select
            class="status-select"
            :value="(row.entry as LibraryEntry).status"
            :aria-label="`Status for ${(row.entry as LibraryEntry).show.name}`"
            @change="
              setStatus(
                row.entry as LibraryEntry,
                ($event.target as HTMLSelectElement).value as UserShowStatus,
              )
            "
          >
            <option v-for="o in statusOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </template>
        <template #cell-rating="{ row }">
          <AStarRating
            :model-value="(row.entry as LibraryEntry).rating"
            size="sm"
            @update:model-value="rate(row.entry as LibraryEntry, $event)"
          />
        </template>
        <template #cell-progress="{ row }">
          <span
            v-if="watched.progress.get((row.entry as LibraryEntry).show_id)?.aired"
            class="progress-cell"
          >
            <AProgressBar
              :value="watched.progress.get((row.entry as LibraryEntry).show_id)!.watched"
              :max="watched.progress.get((row.entry as LibraryEntry).show_id)!.aired"
              label="Watched"
            />
            <span class="t-muted t-mono progress-cell__label"
              >{{ watched.progress.get((row.entry as LibraryEntry).show_id)!.watched }} /
              {{ watched.progress.get((row.entry as LibraryEntry).show_id)!.aired }}</span
            >
          </span>
          <span v-else class="t-muted">—</span>
        </template>
        <template #cell-next="{ row }">
          <span v-if="next(row.entry as LibraryEntry)" class="next-cell">
            <span class="next-cell__when">{{ badge(row.entry as LibraryEntry) }}</span>
            <span class="t-muted t-mono next-cell__code">{{
              episodeCode(
                next(row.entry as LibraryEntry)!.season,
                next(row.entry as LibraryEntry)!.number,
              )
            }}</span>
          </span>
          <span v-else class="t-muted">—</span>
        </template>
        <template #cell-show_status="{ row }">
          <ABadge
            :variant="(row.entry as LibraryEntry).show.status === 'Running' ? 'success' : 'muted'"
            >{{ (row.entry as LibraryEntry).show.status ?? '—' }}</ABadge
          >
        </template>
        <template #cell-added_at="{ row }"
          ><span class="t-muted">{{
            timeAgo((row.entry as LibraryEntry).added_at)
          }}</span></template
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
.library {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.library__tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: -8px;
}
.library__filters {
  min-width: 0;
}
.library__right {
  display: flex;
  gap: 8px;
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
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
  gap: var(--grid-gap);
}
.show-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--fg);
  min-width: 220px;
}
.show-cell__img {
  width: 36px;
  flex: none;
}
.show-cell__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.show-cell__name {
  font-weight: 600;
  font-size: 14px;
}
.show-cell__meta {
  font: 500 11.5px var(--font-mono);
  color: var(--muted);
}
.status-select {
  appearance: none;
  border: 1px solid var(--line2);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--fg);
  font-size: 13px;
  font-weight: 500;
  padding: 6px 28px 6px 12px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239d9da4' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  cursor: pointer;
}
.status-select:hover {
  background-color: var(--hover);
}
.progress-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 110px;
}
.progress-cell__label {
  font-size: 11.5px;
}
.next-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.next-cell__when {
  font: 600 12.5px var(--font-mono);
  color: var(--primary-text);
  white-space: nowrap;
}
.next-cell__code {
  font-size: 11.5px;
}
@media (max-width: 759px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(var(--card-min-mobile), 1fr));
    gap: var(--grid-gap-mobile);
  }
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
