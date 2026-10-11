<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AAppShell, AAvatar, AIcon, ASearchBox, type NavItem } from '@/design-system'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useNotificationsStore } from '@/stores/notifications'

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
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      to: { name: 'settings' },
      // The header avatar opens Settings on phones.
      mobile: 'hidden',
    },
  ]
  if (auth.isAdmin)
    items.push({
      id: 'admin',
      label: 'Admin',
      icon: 'shield',
      to: { name: 'admin' },
      mobile: 'header',
    })
  return items
})
const activeId = computed(() => {
  const name = String(route.name ?? '')
  if (name.startsWith('admin')) return 'admin'
  if (name === 'show') return 'library'
  return name
})

onMounted(async () => {
  await auth.init()
  if (auth.user) {
    void library.load()
    void notifications.refreshUnreadCount()
    notifications.subscribe(auth.user.id)
  }
})
onBeforeUnmount(() => {
  notifications.unsubscribe()
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
