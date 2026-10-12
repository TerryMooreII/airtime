<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { AAlert, ABadge, AButton, ACard, AHeader, ATable, type TableColumn } from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useBusyAction } from '@/composables/useBusyAction'
import { enqueueSync, fetchSyncQueue, fetchSyncRuns, syncStatusVariant } from '@/lib/api/admin'
import { timeAgo } from '@/lib/format'
import type { Json } from '@/lib/database.types'
import type { SyncJobType, SyncQueueJob, SyncRun, SyncStatus } from '@/types/domain'

const queue = ref<SyncQueueJob[]>([])
const runs = ref<SyncRun[]>([])
const { busy, run: act } = useBusyAction<string>()
let timer: ReturnType<typeof setInterval> | undefined

const {
  loading,
  error,
  run: load,
} = useAsync(async () => {
  ;[queue.value, runs.value] = await Promise.all([fetchSyncQueue(), fetchSyncRuns()])
})
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
const enqueue = (job: (typeof JOBS)[number]) =>
  act(
    job.type,
    () => enqueueSync(job.type, job.payload ?? {}),
    (id) => (id ? `${job.label} queued` : `${job.label} is already queued`),
    load,
  )

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
  <div class="page sync">
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
      <AHeader level="section" title="Queue">
        <AButton variant="ghost" size="sm" icon="refresh" :loading="loading" @click="load"
          >Refresh</AButton
        >
      </AHeader>
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
          ><span class="t-muted err clamp-2">{{ value ?? '' }}</span></template
        >
      </ATable>
    </section>

    <section class="sync__section">
      <AHeader level="section" title="Run history" />
      <ATable :columns="runColumns" :rows="runs" empty-text="No runs yet.">
        <template #cell-job_type="{ value }"
          ><span class="t-mono">{{ value }}</span></template
        >
        <template #cell-status="{ row }">
          <ABadge :variant="badge(row.status as SyncStatus)">{{ row.status }}</ABadge>
          <span v-if="row.error" class="t-muted err clamp-2"> {{ row.error }}</span>
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
.sync__jobs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}
.job {
  gap: var(--space-1_5);
}
.job__label {
  font-weight: 600;
}
.job__hint {
  font-size: var(--text-xs);
  color: var(--muted);
  margin-bottom: var(--space-2);
}
.sync__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.payload {
  font-size: var(--text-xs);
  word-break: break-all;
}
.err {
  font-size: var(--text-xs);
  max-width: 320px;
}
</style>
