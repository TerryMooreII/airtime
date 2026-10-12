<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { AAlert, ABadge, AButton, ACard, ASkeleton, AStat } from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useBusyAction } from '@/composables/useBusyAction'
import { enqueueSync, fetchAdminStats, fetchSyncRuns, syncStatusVariant } from '@/lib/api/admin'
import { timeAgo } from '@/lib/format'
import type { AdminStats, SyncRun } from '@/types/domain'

const stats = ref<AdminStats | null>(null)
const runs = ref<SyncRun[]>([])
const { busy, run: act } = useBusyAction<string>()

const {
  loading,
  error,
  run: load,
} = useAsync(
  async () => {
    ;[stats.value, runs.value] = await Promise.all([fetchAdminStats(), fetchSyncRuns(8)])
  },
  { initialLoading: true },
)
onMounted(load)

const catalog = computed(() => stats.value?.catalog_import)
const catalogLabel = computed(() => {
  if (!catalog.value) return 'Not started'
  if (catalog.value.completed_at) return `Complete · ${timeAgo(catalog.value.completed_at)}`
  return `Page ${catalog.value.last_page ?? 0} · running`
})
const queue = computed(() => stats.value?.queue ?? null)

const run = (job: 'full_schedule' | 'show_updates') =>
  act(
    job,
    () => enqueueSync(job),
    (id) =>
      id ? 'Job queued; the worker picks it up within a minute.' : 'That job is already queued.',
    load,
  )
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString()
</script>

<template>
  <div class="page dash">
    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>
    <div v-if="loading && !stats" class="dash__stats">
      <ASkeleton v-for="i in 6" :key="i" height="96px" />
    </div>
    <template v-else-if="stats">
      <div class="dash__stats">
        <AStat
          label="Shows"
          :value="fmt(stats.shows)"
          :hint="`${fmt(stats.shows_with_episodes)} with episode history`"
        />
        <AStat label="Episodes" :value="fmt(stats.episodes)" />
        <AStat
          label="Users"
          :value="fmt(stats.users)"
          :hint="`${fmt(stats.tracked_shows)} shows tracked`"
        />
        <AStat label="Alerts · 24h" :value="fmt(stats.notifications_24h)" />
        <AStat
          label="Queue"
          :value="fmt((queue?.queued ?? 0) + (queue?.running ?? 0))"
          :hint="`${fmt(queue?.failed)} failed`"
        />
        <AStat
          label="Catalog import"
          :value="
            catalog?.completed_at
              ? 'Done'
              : catalog?.last_page != null
                ? `p.${catalog.last_page}`
                : '—'
          "
          :hint="catalogLabel"
        />
      </div>

      <div class="dash__grid">
        <ACard padding="lg">
          <span class="t-label">Nightly sync</span>
          <p class="dash__p">
            The full TVMaze schedule and show updates import every night at 06:00 UTC. Trigger
            either job now:
          </p>
          <div class="cluster dash__actions">
            <AButton
              variant="outline"
              icon="refresh"
              :loading="busy === 'full_schedule'"
              @click="run('full_schedule')"
              >Import full schedule</AButton
            >
            <AButton
              variant="outline"
              icon="refresh"
              :loading="busy === 'show_updates'"
              @click="run('show_updates')"
              >Check show updates</AButton
            >
          </div>
          <div v-if="stats.last_full_schedule" class="dash__last">
            <ABadge :variant="syncStatusVariant(stats.last_full_schedule.status)">{{
              stats.last_full_schedule.status
            }}</ABadge>
            <span class="t-muted"
              >Last schedule import {{ timeAgo(stats.last_full_schedule.finished_at) }}</span
            >
          </div>
        </ACard>
        <ACard padding="lg">
          <span class="t-label">Recent runs</span>
          <ul class="runs">
            <li v-for="r in runs" :key="r.id" class="runs__item">
              <ABadge :variant="syncStatusVariant(r.status)">{{ r.status }}</ABadge>
              <span class="runs__type t-mono">{{ r.job_type }}</span>
              <span class="runs__when t-muted">{{ timeAgo(r.finished_at) }}</span>
            </li>
            <li v-if="!runs.length" class="t-muted">No runs yet.</li>
          </ul>
          <AButton variant="ghost" size="sm" :to="{ name: 'admin-sync' }">Open sync queue</AButton>
        </ACard>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dash__stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}
.dash__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}
.dash__p {
  color: var(--muted);
  font-size: var(--text-base);
  margin: 8px 0 14px;
}
.dash__last {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  margin-top: var(--space-3_5);
  font-size: var(--text-sm);
}
.runs {
  list-style: none;
  padding: 0;
  margin: 10px 0 12px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.runs__item {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  font-size: var(--text-sm);
}
.runs__type {
  font-weight: 500;
}
.runs__when {
  margin-left: auto;
  font-size: var(--text-xs);
}
</style>
