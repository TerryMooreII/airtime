<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import {
  AAlert,
  ABadge,
  AButton,
  APoster,
  ASearchBox,
  ATable,
  type TableColumn,
} from '@/design-system'
import { useBusyAction } from '@/composables/useBusyAction'
import { useDebouncedQuery } from '@/composables/useDebouncedQuery'
import { enqueueSync, searchAdminShows, type AdminShowRow } from '@/lib/api/admin'
import { timeAgo } from '@/lib/format'

const {
  query,
  results: rows,
  loading,
  error,
  refresh: load,
} = useDebouncedQuery((q) => searchAdminShows(q), { empty: [] as AdminShowRow[] })
onMounted(load)

const { busy: busyId, run: act } = useBusyAction<number>()
const refresh = (row: AdminShowRow) =>
  act(
    row.id,
    () => enqueueSync('show_refresh', { tvmaze_id: row.tvmaze_id }),
    (id) => (id ? `Refresh queued for ${row.name}` : 'Already queued'),
  )

const columns: TableColumn[] = [
  { key: 'name', label: 'Show' },
  { key: 'status', label: 'Status' },
  { key: 'followers', label: 'Followers', align: 'right' },
  { key: 'episodes_synced_at', label: 'Episodes' },
  { key: 'synced_at', label: 'Last sync' },
  { key: 'actions', label: '', align: 'right' },
]
</script>

<template>
  <div class="shows">
    <ASearchBox v-model="query" placeholder="Search the catalog by name" size="lg" />
    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>
    <ATable :columns="columns" :rows="rows" :loading="loading" empty-text="No shows match.">
      <template #cell-name="{ row }">
        <RouterLink :to="{ name: 'show', params: { id: row.id } }" class="show-cell">
          <APoster :src="row.image_medium" radius="sm" class="show-cell__img" />
          <span class="show-cell__text">
            <span class="show-cell__name">{{ row.name }}</span>
            <span class="t-muted t-mono show-cell__meta"
              >tvmaze #{{ row.tvmaze_id
              }}<template v-if="row.premiered">
                · {{ String(row.premiered).slice(0, 4) }}</template
              ></span
            >
          </span>
        </RouterLink>
      </template>
      <template #cell-status="{ value }"
        ><ABadge variant="muted">{{ value ?? '—' }}</ABadge></template
      >
      <template #cell-episodes_synced_at="{ value }">
        <ABadge v-if="value" variant="success">synced {{ timeAgo(String(value)) }}</ABadge>
        <ABadge v-else variant="muted">upcoming only</ABadge>
      </template>
      <template #cell-synced_at="{ value }"
        ><span class="t-muted">{{ timeAgo(value as string | null) }}</span></template
      >
      <template #cell-actions="{ row }">
        <AButton
          variant="outline"
          size="sm"
          icon="refresh"
          :loading="busyId === row.id"
          @click="refresh(row)"
          >Refresh</AButton
        >
      </template>
    </ATable>
  </div>
</template>

<style scoped>
.shows {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.show-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--fg);
  min-width: 220px;
}
.show-cell__img {
  width: 32px;
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
}
.show-cell__meta {
  font-size: 11.5px;
}
</style>
