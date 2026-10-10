import { ref, watch } from 'vue'

import { supabase } from '@/lib/supabase'
import type { SearchResult } from '@/types/domain'

import { useDebouncedRef } from './useDebouncedRef'

const PAGE = 24

/** Debounced full-text search over the local show catalog (search_shows RPC). */
export function useShowSearch() {
  const query = ref('')
  const debounced = useDebouncedRef('', 250)
  const results = ref<SearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hasMore = ref(false)
  let requestId = 0

  watch(query, (q) => {
    debounced.value = q
  })

  async function search(q: string, offset = 0): Promise<void> {
    const id = ++requestId
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      results.value = []
      hasMore.value = false
      return
    }
    loading.value = true
    error.value = null
    const { data, error: err } = await supabase.rpc('search_shows', {
      p_query: trimmed,
      p_limit: PAGE,
      p_offset: offset,
    })
    if (id !== requestId) return
    loading.value = false
    if (err) {
      error.value = err.message
      return
    }
    const rows = (data ?? []) as SearchResult[]
    results.value = offset === 0 ? rows : [...results.value, ...rows]
    hasMore.value = rows.length === PAGE
  }

  watch(debounced, (q) => void search(q))

  function loadMore(): Promise<void> {
    return search(debounced.value, results.value.length)
  }

  return { query, results, loading, error, hasMore, loadMore }
}
