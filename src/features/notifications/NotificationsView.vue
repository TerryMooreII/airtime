<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import {
  AButton,
  AEmptyState,
  AHeader,
  AIcon,
  ALoadMore,
  APoster,
  ASkeleton,
} from '@/design-system'
import { timeAgo } from '@/lib/format'
import { useNotificationsStore } from '@/stores/notifications'
import { useUiStore } from '@/stores/ui'
import type { AppNotification } from '@/types/domain'

const notifications = useNotificationsStore()
const ui = useUiStore()

onMounted(() => void notifications.load(true))

async function open(n: AppNotification) {
  if (!n.read_at) await notifications.markRead([n.id]).catch(() => undefined)
}
const markAll = () => ui.attempt(() => notifications.markAllRead())
const remove = (n: AppNotification) => ui.attempt(() => notifications.remove(n.id))
const KIND: Record<AppNotification['type'], string> = {
  new_episode: 'New episode',
  airing_today: 'Airing today',
  show_status_changed: 'Show update',
  test: 'Test',
}
</script>

<template>
  <div class="page notifs">
    <AHeader
      title="Alerts"
      :subtitle="
        notifications.unreadCount ? `${notifications.unreadCount} unread` : 'You are all caught up.'
      "
    >
      <AButton
        v-if="notifications.unreadCount"
        variant="outline"
        size="sm"
        icon="check"
        @click="markAll"
        >Mark all read</AButton
      >
    </AHeader>

    <div v-if="notifications.loading && !notifications.items.length" class="notifs__list">
      <ASkeleton v-for="i in 5" :key="i" height="76px" />
    </div>

    <div v-else-if="notifications.items.length" class="notifs__list">
      <div
        v-for="n in notifications.items"
        :key="n.id"
        class="item"
        :class="{ 'item--unread': !n.read_at }"
      >
        <RouterLink
          :to="n.show_id ? { name: 'show', params: { id: n.show_id } } : { name: 'notifications' }"
          class="item__main"
          @click="open(n)"
        >
          <APoster :src="n.data.image" radius="sm" class="item__img" />
          <span class="stack-tight item__text">
            <span class="t-kicker">{{ KIND[n.type] }} · {{ timeAgo(n.created_at) }}</span>
            <span class="item__title truncate">{{ n.title }}</span>
            <span v-if="n.body" class="item__body">{{ n.body }}</span>
          </span>
        </RouterLink>
        <span v-if="!n.read_at" class="item__dot" aria-label="Unread" />
        <button
          type="button"
          class="item__remove"
          aria-label="Delete notification"
          @click="remove(n)"
        >
          <AIcon name="close" :size="14" />
        </button>
      </div>
      <ALoadMore
        v-if="notifications.hasMore"
        :loading="notifications.loading"
        @more="notifications.load()"
      />
    </div>

    <AEmptyState
      v-else
      title="No alerts yet"
      description="When a show you follow schedules a new episode, you'll hear about it here."
    />
  </div>
</template>

<style scoped>
.notifs__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.item {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  border-radius: var(--radius-xl);
  border: 1px solid var(--line);
  background: var(--surface);
  padding: var(--space-2_5) var(--space-3);
  transition: border-color var(--dur-fast);
}
.item:hover {
  border-color: var(--line2);
}
.item--unread {
  background: color-mix(in srgb, var(--primary-soft) 35%, var(--surface));
}
.item__main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3_5);
  min-width: 0;
  color: var(--fg);
}
.item__img {
  width: 40px;
  flex: none;
}
.item__title {
  font-size: var(--text-md);
  font-weight: 600;
}
.item__body {
  font-size: var(--text-sm);
  color: var(--muted);
}
.item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  flex: none;
}
.item__remove {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  display: flex;
}
.item__remove:hover {
  color: var(--fg);
  background: var(--hover);
}
</style>
