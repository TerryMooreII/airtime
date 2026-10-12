<script setup lang="ts">
import {
  ABadge,
  AMediaRow,
  AProgressBar,
  ASelect,
  AStarRating,
  ATable,
  type TableColumn,
} from '@/design-system'
import {
  channelLabel,
  episodeCode,
  formatAirTime,
  joinMeta,
  shortDayLabel,
  timeAgo,
  yearOf,
} from '@/lib/format'
import {
  USER_SHOW_STATUSES,
  type LibraryEntry,
  type ShowProgress,
  type UpcomingEpisode,
  type UserShowStatus,
} from '@/types/domain'

/** The Library's table layout: one row per followed show with status, rating and progress. */
const props = defineProps<{
  entries: LibraryEntry[]
  nextByShow: Map<number, UpcomingEpisode>
  progress: Map<number, ShowProgress>
  tz: string
}>()
const emit = defineEmits<{
  rate: [entry: LibraryEntry, rating: number | null]
  setStatus: [entry: LibraryEntry, status: UserShowStatus]
}>()

const columns: TableColumn[] = [
  { key: 'show', label: 'Show' },
  { key: 'status', label: 'My status' },
  { key: 'rating', label: 'Rating' },
  { key: 'progress', label: 'Progress' },
  { key: 'next', label: 'Next episode' },
  { key: 'show_status', label: 'Show' },
  { key: 'added_at', label: 'Added' },
]

const next = (e: LibraryEntry) => props.nextByShow.get(e.show_id)
function when(e: LibraryEntry): string {
  const n = next(e)
  return n ? `${shortDayLabel(n.airstamp, props.tz)} ${formatAirTime(n.airstamp, props.tz)}` : ''
}
</script>

<template>
  <ATable :columns="columns" :rows="entries" row-key="show_id">
    <template #cell-show="{ row }">
      <AMediaRow
        :to="{ name: 'show', params: { id: row.show_id } }"
        :image="row.show.image_medium"
        :image-width="36"
        :title="row.show.name"
        :subtitle="joinMeta(yearOf(row.show.premiered), channelLabel(row.show))"
        class="show-cell"
      />
    </template>
    <template #cell-status="{ row }">
      <ASelect
        :model-value="row.status"
        :options="USER_SHOW_STATUSES"
        :aria-label="`Status for ${row.show.name}`"
        class="status-select"
        @update:model-value="emit('setStatus', row, $event as UserShowStatus)"
      />
    </template>
    <template #cell-rating="{ row }">
      <AStarRating
        :model-value="row.rating"
        size="sm"
        @update:model-value="emit('rate', row, $event)"
      />
    </template>
    <template #cell-progress="{ row }">
      <span v-if="progress.get(row.show_id)?.aired" class="progress-cell">
        <AProgressBar
          :value="progress.get(row.show_id)!.watched"
          :max="progress.get(row.show_id)!.aired"
          label="Watched"
        />
        <span class="t-muted t-mono progress-cell__label"
          >{{ progress.get(row.show_id)!.watched }} / {{ progress.get(row.show_id)!.aired }}</span
        >
      </span>
      <span v-else class="t-muted">—</span>
    </template>
    <template #cell-next="{ row }">
      <span v-if="next(row)" class="stack-tight">
        <span class="next-cell__when">{{ when(row) }}</span>
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

<style scoped>
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
</style>
