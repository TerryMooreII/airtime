<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AAppShell, AAvatar, AIcon, ASearchBox, type NavItem } from '@/design-system'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useNotificationsStore } from '@/stores/notifications'
import { fetchUpcomingEpisodes } from '@/lib/api/episodes'
import { formatAirTime, relativeDayLabel } from '@/lib/format'
import type { UpcomingEpisode } from '@/types/domain'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const library = useLibraryStore()
const notifications = useNotificationsStore()
const theme = useTheme()

const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
watch(query, (q) => {
  if (q.trim()) void router.replace({ name: 'search', query: { q } })
  else if (route.name === 'search') void router.replace({ name: 'search' })
})
watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string' && q !== query.value) query.value = q
    if (q === undefined && route.name !== 'search') query.value = ''
  },
)

const nav = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { id: 'home', label: 'Guide', icon: 'guide', to: { name: 'home' } },
    { id: 'library', label: 'Library', icon: 'library', to: { name: 'library' } },
    { id: 'discover', label: 'Discover', icon: 'discover', to: { name: 'discover' } },
    { id: 'search', label: 'Search', icon: 'search', to: { name: 'search' } },
    {
      id: 'notifications',
      label: 'Alerts',
      icon: 'bell',
      to: { name: 'notifications' },
      badge: notifications.unreadCount,
    },
    { id: 'settings', label: 'Settings', icon: 'settings', to: { name: 'settings' } },
  ]
  if (auth.isAdmin)
    items.push({ id: 'admin', label: 'Admin', icon: 'shield', to: { name: 'admin' } })
  return items
})
const activeId = computed(() => {
  const name = String(route.name ?? '')
  if (name.startsWith('admin')) return 'admin'
  if (name === 'show') return 'library'
  return name
})

const soon = ref<UpcomingEpisode[]>([])
async function loadSoon() {
  if (!auth.isAuthenticated) return
  try {
    soon.value = (await fetchUpcomingEpisodes(7, 6))
      .filter((e) => new Date(e.airstamp).getTime() > Date.now() - 3_600_000)
      .slice(0, 6)
  } catch {
    soon.value = []
  }
}

let soonTimer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  await auth.init()
  if (auth.user) {
    void library.load()
    void notifications.refreshUnreadCount()
    notifications.subscribe(auth.user.id)
    void loadSoon()
    soonTimer = setInterval(loadSoon, 5 * 60_000)
  }
})
watch(
  () => library.entries.length,
  () => void loadSoon(),
)
onBeforeUnmount(() => {
  notifications.unsubscribe()
  clearInterval(soonTimer)
})
</script>

<template>
  <AAppShell
    :nav="nav"
    :active-id="activeId"
    :theme-label="theme.resolved.value === 'dark' ? 'Light mode' : 'Dark mode'"
    :theme-icon="theme.resolved.value === 'dark' ? 'sun' : 'moon'"
    @toggle-theme="theme.toggle"
  >
    <template #search>
      <ASearchBox v-model="query" placeholder="Search any show" />
    </template>

    <template #rail>
      <div v-if="soon.length" class="rail">
        <div class="t-label rail__title">Airing soon</div>
        <RouterLink
          v-for="e in soon"
          :key="e.episode_id"
          :to="{ name: 'show', params: { id: e.show_id } }"
          class="rail__item"
        >
          <img v-if="e.show_image" :src="e.show_image" alt="" class="rail__img" />
          <span v-else class="rail__img" />
          <span class="rail__text">
            <span class="rail__name truncate">{{ e.show_name }}</span>
            <span class="rail__when"
              >{{ relativeDayLabel(e.airstamp, auth.timezone) }} ·
              {{ formatAirTime(e.airstamp, auth.timezone) }}</span
            >
          </span>
        </RouterLink>
      </div>
    </template>

    <template #actions>
      <RouterLink :to="{ name: 'notifications' }" class="bell" aria-label="Notifications">
        <AIcon name="bell" :size="18" />
        <span v-if="notifications.unreadCount" class="bell__count">{{
          notifications.unreadCount > 99 ? '99+' : notifications.unreadCount
        }}</span>
      </RouterLink>
      <RouterLink :to="{ name: 'settings' }" class="me" aria-label="Account">
        <AAvatar
          :name="auth.profile?.display_name ?? auth.user?.email"
          :src="auth.profile?.avatar_url"
          :size="32"
        />
      </RouterLink>
    </template>

    <slot />
  </AAppShell>
</template>

<style scoped>
.rail__title {
  padding: 0 12px 4px;
}
.rail__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  color: var(--fg);
}
.rail__item:hover {
  background: var(--hover);
}
.rail__img {
  width: 26px;
  height: 38px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--surface2);
  flex: none;
}
.rail__text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.rail__name {
  font-size: 13px;
  font-weight: 600;
}
.rail__when {
  font: 500 11.5px var(--font-mono);
  color: var(--primary-text);
}
.bell {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  color: var(--fg);
}
.bell:hover {
  background: var(--hover);
}
.bell__count {
  position: absolute;
  top: -5px;
  right: -5px;
  font: 600 10px var(--font-mono);
  background: var(--primary);
  color: var(--on-primary);
  padding: 2px 5px;
  border-radius: 999px;
  min-width: 18px;
  text-align: center;
}
.me {
  display: flex;
}
@media (max-width: 759px) {
  .bell {
    display: none;
  }
}
</style>
