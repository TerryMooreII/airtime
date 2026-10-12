<script setup lang="ts">
import { onMounted } from 'vue'

import { AAlert, ABadge, AButton, ASearchBox, ATable, type TableColumn } from '@/design-system'
import { useBusyAction } from '@/composables/useBusyAction'
import { useDebouncedQuery } from '@/composables/useDebouncedQuery'
import { enqueueSync, searchAdminShows, type AdminShowRow } from '@/lib/api/admin'
import { joinMeta, timeAgo, yearOf } from '@/lib/format'

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
        <AMediaRow
          :to="{ name: 'show', params: { id: row.id } }"
          :image="row.image_medium"
          :image-width="32"
          :title="row.name"
          :subtitle="joinMeta(`tvmaze #${row.tvmaze_id}`, yearOf(row.premiered))"
          class="show-cell"
        />
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
  min-width: 220px;
}
</style>
