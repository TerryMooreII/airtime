import type { RealtimeChannel } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationsRead,
} from '@/lib/api/notifications'
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types/domain'

const PAGE_SIZE = 30

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const hasMore = ref(true)
  let channel: RealtimeChannel | null = null

  async function refreshUnreadCount(): Promise<void> {
    unreadCount.value = await fetchUnreadCount()
  }

  async function load(reset = false): Promise<void> {
    if (loading.value) return
    loading.value = true
    try {
      const from = reset ? 0 : items.value.length
      const rows = await fetchNotifications(from, PAGE_SIZE)
      items.value = reset ? rows : [...items.value, ...rows]
      hasMore.value = rows.length === PAGE_SIZE
    } finally {
      loading.value = false
    }
  }

  async function markRead(ids: number[]): Promise<void> {
    if (!ids.length) return
    await markNotificationsRead(ids)
    const now = new Date().toISOString()
    let changed = 0
    for (const n of items.value)
      if (ids.includes(n.id) && !n.read_at) {
        n.read_at = now
        changed++
      }
    // Rows that are not loaded locally are counted on the next resync (focus / realtime).
    unreadCount.value = Math.max(0, unreadCount.value - changed)
  }

  async function markAllRead(): Promise<void> {
    await markAllNotificationsRead()
    const now = new Date().toISOString()
    for (const n of items.value) if (!n.read_at) n.read_at = now
    unreadCount.value = 0
  }

  async function remove(id: number): Promise<void> {
    await deleteNotification(id)
    const removed = items.value.find((n) => n.id === id)
    items.value = items.value.filter((n) => n.id !== id)
    if (removed && !removed.read_at) unreadCount.value = Math.max(0, unreadCount.value - 1)
  }

  function onVisible(): void {
    if (document.visibilityState === 'visible') void refreshUnreadCount()
  }

  /**
   * Realtime inserts for the signed-in user. Reads on another device and events missed while
   * disconnected never arrive, so the count is also resynced on (re)subscribe and on focus.
   */
  function subscribe(userId: string): void {
    unsubscribe()
    channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as AppNotification
          if (!items.value.some((n) => n.id === row.id)) items.value = [row, ...items.value]
          unreadCount.value += 1
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refreshUnreadCount()
      })
    document.addEventListener('visibilitychange', onVisible)
  }

  function unsubscribe(): void {
    document.removeEventListener('visibilitychange', onVisible)
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
  }

  function reset(): void {
    unsubscribe()
    items.value = []
    unreadCount.value = 0
    hasMore.value = true
  }

  return {
    items,
    unreadCount,
    loading,
    hasMore,
    load,
    refreshUnreadCount,
    markRead,
    markAllRead,
    remove,
    subscribe,
    unsubscribe,
    reset,
  }
})
