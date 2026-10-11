<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  AAlert,
  AButton,
  AInput,
  APageHeader,
  ASegmented,
  ASelect,
  ASettingsGroup,
  ASettingsRow,
  AToggle,
} from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { usePushSubscription } from '@/composables/usePushSubscription'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { sendTestNotification } from '@/lib/api/notifications'
import { browserTimeZone } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useNotificationsStore } from '@/stores/notifications'
import { useUiStore } from '@/stores/ui'
import { useUpcomingStore } from '@/stores/upcoming'
import { useWatchedStore } from '@/stores/watched'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const theme = useTheme()
const push = usePushSubscription()

const displayName = ref(auth.profile?.display_name ?? '')
const savingName = ref(false)

const timezones = computed(() => {
  const list =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [browserTimeZone(), 'UTC']
  const set = new Set([...list, auth.timezone, 'UTC'])
  return [...set].sort().map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }))
})
const hours = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' }),
}))
const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
]

onMounted(() => void push.refresh())

async function save(patch: Parameters<typeof auth.updateProfile>[0], message = 'Saved') {
  try {
    await auth.updateProfile(patch)
    ui.success(message)
  } catch (err) {
    ui.error(errorMessage(err))
  }
}
async function saveName() {
  savingName.value = true
  await save({ display_name: displayName.value.trim() || null }, 'Name updated')
  savingName.value = false
}
const pushOn = computed(() => (auth.profile?.notify_push ?? false) && push.subscribed.value)
const sendingTest = ref(false)
async function sendTest() {
  sendingTest.value = true
  try {
    await sendTestNotification()
    ui.toast('Test sent. It should pop up in a moment and appear under Alerts.')
  } catch (err) {
    ui.error(errorMessage(err))
  } finally {
    sendingTest.value = false
  }
}
async function togglePush(on: boolean) {
  if (on) {
    const ok = await push.enable()
    if (ok) await save({ notify_push: true }, 'Push notifications enabled')
  } else {
    await push.disable()
    await save({ notify_push: false }, 'Push notifications disabled')
  }
}
async function signOut() {
  useNotificationsStore().reset()
  useLibraryStore().reset()
  useWatchedStore().reset()
  useUpcomingStore().reset()
  await auth.signOut()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="settings">
    <APageHeader title="Settings" />

    <ASettingsGroup title="Account">
      <ASettingsRow title="Name" :description="auth.user?.email ?? ''">
        <form class="name-form" @submit.prevent="saveName">
          <AInput v-model="displayName" placeholder="Your name" autocomplete="name" />
          <AButton
            type="submit"
            variant="outline"
            :loading="savingName"
            :disabled="displayName.trim() === (auth.profile?.display_name ?? '')"
            >Save</AButton
          >
        </form>
      </ASettingsRow>
      <ASettingsRow title="Role" description="Admins can manage shows, users and the sync queue.">
        <span class="role">{{ auth.isAdmin ? 'Admin' : 'Member' }}</span>
      </ASettingsRow>
      <ASettingsRow
        title="Import shows"
        description="Bring in a CSV of show names and ratings; you confirm every match before it's saved."
      >
        <AButton variant="outline" icon="plus" :to="{ name: 'import' }">Import CSV</AButton>
      </ASettingsRow>
      <ASettingsRow title="Sign out" description="You'll need your password to sign back in.">
        <AButton variant="outline" icon="logout" @click="signOut">Sign out</AButton>
      </ASettingsRow>
    </ASettingsGroup>

    <ASettingsGroup title="Appearance &amp; time">
      <ASettingsRow title="Theme" description="System follows your device setting.">
        <ASegmented v-model="theme.mode.value" :options="themeOptions" aria-label="Theme" />
      </ASettingsRow>
      <ASettingsRow
        title="Time zone"
        description="Air times and daily digests use this zone."
        stacked
      >
        <ASelect
          :model-value="auth.timezone"
          :options="timezones"
          @update:model-value="save({ timezone: String($event) }, 'Time zone updated')"
        />
        <AButton
          v-if="browserTimeZone() !== auth.timezone"
          variant="ghost"
          size="sm"
          @click="save({ timezone: browserTimeZone() }, 'Time zone updated')"
          >Use {{ browserTimeZone() }}</AButton
        >
      </ASettingsRow>
    </ASettingsGroup>

    <ASettingsGroup title="Notifications">
      <ASettingsRow
        title="In-app alerts"
        description="New episodes and airing-today reminders in your alerts list."
      >
        <AToggle
          :model-value="auth.profile?.notify_in_app ?? true"
          label="In-app alerts"
          @update:model-value="save({ notify_in_app: $event })"
        />
      </ASettingsRow>
      <ASettingsRow
        title="Browser push"
        :description="
          push.supported.value
            ? push.configured.value
              ? 'Get a notification even when Airtime is closed.'
              : 'Not configured on this deployment.'
            : 'Not supported by this browser.'
        "
      >
        <AButton
          variant="ghost"
          size="sm"
          :disabled="!pushOn || sendingTest"
          :loading="sendingTest"
          @click="sendTest"
          >Send test</AButton
        >
        <AToggle
          :model-value="pushOn"
          label="Browser push"
          :disabled="!push.configured.value || push.busy.value"
          @update:model-value="togglePush"
        />
      </ASettingsRow>
      <AAlert v-if="push.error.value" variant="warning" class="push-error">{{
        push.error.value
      }}</AAlert>
      <ASettingsRow
        title="Daily reminder time"
        description="When to tell you about episodes airing that day."
      >
        <ASelect
          :model-value="auth.profile?.airing_digest_hour ?? 9"
          :options="hours"
          @update:model-value="save({ airing_digest_hour: Number($event) })"
        />
      </ASettingsRow>
    </ASettingsGroup>

    <p class="foot">
      Show and episode data from
      <a href="https://www.tvmaze.com" target="_blank" rel="noopener">TVmaze</a> (CC BY-SA).
    </p>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-width: 760px;
}
.name-form {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.role {
  font: 600 12px var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--primary-soft);
  color: var(--primary-text);
}
.push-error {
  margin: 0 18px 14px;
}
.foot {
  font-size: 13px;
  color: var(--muted);
}
</style>
