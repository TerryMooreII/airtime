<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { AAlert, ABadge, AButton, APoster, ASearchBox, ATable, type TableColumn } from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { enqueueSync, searchAdminShows, type AdminShowRow } from '@/lib/api/admin'
import { timeAgo } from '@/lib/format'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const query = ref('')
const debounced = useDebouncedRef('', 250)
const rows = ref<AdminShowRow[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const busyId = ref<number | null>(null)

watch(query, (q) => (debounced.value = q))
watch(debounced, () => void load())

async function load() {
  loading.value = true
  error.value = null
  try {
    rows.value = await searchAdminShows(debounced.value)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function refresh(row: AdminShowRow) {
  busyId.value = row.id
  try {
    const id = await enqueueSync('show_refresh', { tvmaze_id: row.tvmaze_id })
    ui.success(id ? `Refresh queued for ${row.name}` : 'Already queued')
  } catch (err) {
    ui.error(errorMessage(err))
  } finally {
    busyId.value = null
  }
}

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
        <RouterLink :to="{ name: 'show', params: { id: row.id as number } }" class="show-cell">
          <APoster :src="(row.image_medium as string)" radius="sm" class="show-cell__img" />
          <span class="show-cell__text">
            <span class="show-cell__name">{{ row.name }}</span>
            <span class="t-muted t-mono show-cell__meta">tvmaze #{{ row.tvmaze_id }}<template v-if="row.premiered"> · {{ String(row.premiered).slice(0, 4) }}</template></span>
          </span>
        </RouterLink>
      </template>
      <template #cell-status="{ value }"><ABadge variant="muted">{{ value ?? '—' }}</ABadge></template>
      <template #cell-episodes_synced_at="{ value }">
        <ABadge v-if="value" variant="success">synced {{ timeAgo(String(value)) }}</ABadge>
        <ABadge v-else variant="muted">upcoming only</ABadge>
      </template>
      <template #cell-synced_at="{ value }"><span class="t-muted">{{ value ? timeAgo(String(value)) : '—' }}</span></template>
      <template #cell-actions="{ row }">
        <AButton variant="outline" size="sm" icon="refresh" :loading="busyId === row.id" @click="refresh(row as unknown as AdminShowRow)">Refresh</AButton>
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
