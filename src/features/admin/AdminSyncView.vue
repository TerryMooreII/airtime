<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { AAlert, ABadge, AButton, ACard, ATable, type TableColumn } from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { enqueueSync, fetchSyncQueue, fetchSyncRuns, syncStatusVariant } from '@/lib/api/admin'
import { timeAgo } from '@/lib/format'
import { useUiStore } from '@/stores/ui'
import type { Json } from '@/lib/database.types'
import type { SyncJobType, SyncQueueJob, SyncRun, SyncStatus } from '@/types/domain'

const ui = useUiStore()
const queue = ref<SyncQueueJob[]>([])
const runs = ref<SyncRun[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const busy = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

async function load() {
  loading.value = true
  error.value = null
  try {
    ;[queue.value, runs.value] = await Promise.all([fetchSyncQueue(), fetchSyncRuns()])
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  void load()
  timer = setInterval(load, 15_000)
})
onBeforeUnmount(() => clearInterval(timer))

const JOBS: { type: SyncJobType; label: string; payload?: Record<string, Json>; hint: string }[] = [
  { type: 'full_schedule', label: 'Full schedule', hint: 'All upcoming episodes (15 MB feed)' },
  { type: 'show_updates', label: 'Show updates', hint: 'Shows TVMaze changed in the last day' },
  {
    type: 'catalog_page',
    label: 'Restart catalog',
    payload: { page: 0 },
    hint: 'Walk every /shows page again',
  },
]
async function enqueue(job: (typeof JOBS)[number]) {
  busy.value = job.type
  try {
    const id = await enqueueSync(job.type, job.payload ?? {})
    ui.success(id ? `${job.label} queued` : `${job.label} is already queued`)
    await load()
  } catch (err) {
    ui.error(errorMessage(err))
  } finally {
    busy.value = null
  }
}

const badge = syncStatusVariant
const queueColumns: TableColumn[] = [
  { key: 'id', label: '#' },
  { key: 'job_type', label: 'Job' },
  { key: 'payload', label: 'Payload' },
  { key: 'status', label: 'Status' },
  { key: 'attempts', label: 'Attempts', align: 'right' },
  { key: 'run_after', label: 'Runs' },
  { key: 'last_error', label: 'Error' },
]
const runColumns: TableColumn[] = [
  { key: 'job_type', label: 'Job' },
  { key: 'status', label: 'Status' },
  { key: 'finished_at', label: 'Finished' },
  { key: 'stats', label: 'Stats' },
]
function summarize(stats: unknown): string {
  if (!stats || typeof stats !== 'object') return ''
  return Object.entries(stats as Record<string, unknown>)
    .filter(
      ([k, v]) =>
        k !== 'inserted_ids' &&
        (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean'),
    )
    .map(([k, v]) => `${k}=${v}`)
    .join(' · ')
}
</script>

<template>
  <div class="sync">
    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>
    <div class="sync__jobs">
      <ACard v-for="j in JOBS" :key="j.type" padding="md" class="job">
        <span class="job__label">{{ j.label }}</span>
        <span class="job__hint">{{ j.hint }}</span>
        <AButton
          variant="outline"
          size="sm"
          icon="play"
          :loading="busy === j.type"
          @click="enqueue(j)"
          >Run now</AButton
        >
      </ACard>
    </div>

    <section class="sync__section">
      <div class="sync__head">
        <span class="t-h2">Queue</span
        ><AButton variant="ghost" size="sm" icon="refresh" :loading="loading" @click="load"
          >Refresh</AButton
        >
      </div>
      <ATable :columns="queueColumns" :rows="queue" empty-text="Queue is empty.">
        <template #cell-job_type="{ value }"
          ><span class="t-mono">{{ value }}</span></template
        >
        <template #cell-payload="{ value }"
          ><span class="t-mono t-muted payload">{{ JSON.stringify(value) }}</span></template
        >
        <template #cell-status="{ value }"
          ><ABadge :variant="badge(value as SyncStatus)">{{ value }}</ABadge></template
        >
        <template #cell-attempts="{ row }">{{ row.attempts }}/{{ row.max_attempts }}</template>
        <template #cell-run_after="{ value }"
          ><span class="t-muted">{{ timeAgo(String(value)) }}</span></template
        >
        <template #cell-last_error="{ value }"
          ><span class="t-muted err">{{ value ?? '' }}</span></template
        >
      </ATable>
    </section>

    <section class="sync__section">
      <span class="t-h2">Run history</span>
      <ATable :columns="runColumns" :rows="runs" empty-text="No runs yet.">
        <template #cell-job_type="{ value }"
          ><span class="t-mono">{{ value }}</span></template
        >
        <template #cell-status="{ row }">
          <ABadge :variant="badge(row.status as SyncStatus)">{{ row.status }}</ABadge>
          <span v-if="row.error" class="t-muted err"> {{ row.error }}</span>
        </template>
        <template #cell-finished_at="{ value }"
          ><span class="t-muted">{{ timeAgo(String(value)) }}</span></template
        >
        <template #cell-stats="{ value }"
          ><span class="t-mono t-muted payload">{{ summarize(value) }}</span></template
        >
      </ATable>
    </section>
  </div>
</template>

<style scoped>
.sync {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.sync__jobs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.job {
  gap: 6px;
}
.job__label {
  font-weight: 600;
}
.job__hint {
  font-size: 12.5px;
  color: var(--muted);
  margin-bottom: 8px;
}
.sync__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sync__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.payload {
  font-size: 12px;
  word-break: break-all;
}
.err {
  font-size: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 320px;
}
</style>
