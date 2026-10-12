import { ref, watch } from 'vue'

import { errorMessage } from '@/composables/useAsync'
import { searchShows } from '@/lib/api/shows'
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
    let rows: SearchResult[]
    try {
      rows = await searchShows(trimmed, PAGE, offset)
    } catch (err) {
      if (id !== requestId) return
      loading.value = false
      error.value = errorMessage(err)
      return
    }
    if (id !== requestId) return
    loading.value = false
    results.value = offset === 0 ? rows : [...results.value, ...rows]
    hasMore.value = rows.length === PAGE
  }

  watch(debounced, (q) => void search(q))

  function loadMore(): Promise<void> {
    return search(debounced.value, results.value.length)
  }

  return { query, results, loading, error, hasMore, loadMore }
}
