import type { RealtimeChannel } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types/domain'

const PAGE_SIZE = 30

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const hasMore = ref(true)
  let channel: RealtimeChannel | null = null

  const unread = computed(() => items.value.filter((n) => !n.read_at))

  async function refreshUnreadCount(): Promise<void> {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
    unreadCount.value = count ?? 0
  }

  async function load(reset = false): Promise<void> {
    if (loading.value) return
    loading.value = true
    try {
      const from = reset ? 0 : items.value.length
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      const rows = (data ?? []) as AppNotification[]
      items.value = reset ? rows : [...items.value, ...rows]
      hasMore.value = rows.length === PAGE_SIZE
    } finally {
      loading.value = false
    }
  }

  async function markRead(ids: number[]): Promise<void> {
    if (!ids.length) return
    const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids })
    if (error) throw error
    const now = new Date().toISOString()
    for (const n of items.value) if (ids.includes(n.id) && !n.read_at) n.read_at = now
    await refreshUnreadCount()
  }

  async function markAllRead(): Promise<void> {
    const { error } = await supabase.rpc('mark_all_notifications_read')
    if (error) throw error
    const now = new Date().toISOString()
    for (const n of items.value) if (!n.read_at) n.read_at = now
    unreadCount.value = 0
  }

  async function remove(id: number): Promise<void> {
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) throw error
    items.value = items.value.filter((n) => n.id !== id)
    await refreshUnreadCount()
  }

  /** Subscribe to realtime inserts for the signed-in user. */
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
      .subscribe()
  }

  function unsubscribe(): void {
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
    unread,
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
