<script setup lang="ts">
import { ref, watch } from 'vue'

import { ABadge, AButton, ASettingsRow } from '@/design-system'
import { fetchPushDevices, removePushDevice } from '@/lib/api/pushSubscriptions'
import { formatMonthDay, joinMeta, timeAgo } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { PushDevice } from '@/types/domain'

/** Every browser registered for push, so stale registrations can be removed. */
const props = defineProps<{ currentEndpoint: string | null }>()

const auth = useAuthStore()
const ui = useUiStore()
const devices = ref<PushDevice[]>([])
const removing = ref<number | null>(null)

async function load() {
  devices.value = (await ui.attempt(fetchPushDevices)) ?? devices.value
}
// Enabling or disabling push on this device changes the endpoint and the list.
watch(() => props.currentEndpoint, load, { immediate: true })

async function remove(device: PushDevice) {
  removing.value = device.id
  const done = await ui.attempt(
    async () => {
      await removePushDevice(device.id)
      return true
    },
    `Removed ${deviceName(device.user_agent)}`,
  )
  if (done) devices.value = devices.value.filter((d) => d.id !== device.id)
  removing.value = null
}

// First match wins, so more specific patterns come first (iPhone UAs also say "Mac OS X",
// Edge and Chrome UAs also say "Safari").
const PLATFORMS: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/Windows/, 'Windows'],
  [/Linux|CrOS/, 'Linux'],
]
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/Firefox\/|FxiOS/, 'Firefox'],
  [/Chrome\/|CriOS/, 'Chrome'],
  [/Safari\//, 'Safari'],
]
const match = (ua: string, table: [RegExp, string][]) =>
  table.find(([re]) => re.test(ua))?.[1] ?? null

/** "Firefox on Mac" from a user agent string; push services expose nothing friendlier. */
function deviceName(ua: string | null): string {
  const os = ua ? match(ua, PLATFORMS) : null
  const browser = ua ? match(ua, BROWSERS) : null
  if (os && browser) return `${browser} on ${os}`
  return os ?? browser ?? 'Unknown device'
}

function details(d: PushDevice): string {
  return joinMeta(
    `Added ${formatMonthDay(d.created_at, auth.timezone)}`,
    d.last_success_at ? `last delivered ${timeAgo(d.last_success_at)}` : 'never delivered',
  )
}
</script>

<template>
  <ASettingsRow
    v-if="devices.length"
    title="Devices"
    description="Browsers that receive your push notifications. Remove ones you no longer use."
    stacked
  >
    <ul class="devices">
      <li v-for="d in devices" :key="d.id" class="device">
        <div class="device__text">
          <span class="device__name">
            {{ deviceName(d.user_agent) }}
            <ABadge v-if="d.endpoint === currentEndpoint" variant="soft">This device</ABadge>
            <ABadge v-if="d.failed_at" variant="danger">Failed</ABadge>
          </span>
          <span class="device__meta">{{ details(d) }}</span>
        </div>
        <AButton
          v-if="d.endpoint !== currentEndpoint"
          variant="ghost"
          size="sm"
          :loading="removing === d.id"
          :disabled="removing !== null"
          @click="remove(d)"
          >Remove</AButton
        >
      </li>
    </ul>
  </ASettingsRow>
</template>

<style scoped>
.devices {
  width: 100%;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.device {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.device__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  min-width: 0;
}
.device__name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
.device__meta {
  font-size: var(--text-xs);
  color: var(--muted);
}
</style>
