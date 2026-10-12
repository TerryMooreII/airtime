import { ref, watch, type Ref } from 'vue'

import { errorMessage } from '@/composables/useAsync'

import { useDebouncedRef } from './useDebouncedRef'

interface Options<T> {
  /** Value shown while the query is too short. */
  empty: T
  delay?: number
  minLength?: number
}

/**
 * A text query debounced into a fetch, with stale responses ignored. `refresh()` re-runs the
 * current query (after a mutation, say).
 */
export function useDebouncedQuery<T>(fetcher: (query: string) => Promise<T>, opts: Options<T>) {
  const query = ref('')
  const debounced = useDebouncedRef('', opts.delay ?? 250)
  const results = ref(opts.empty) as Ref<T>
  const loading = ref(false)
  const error = ref<string | null>(null)
  let requestId = 0

  watch(query, (q) => {
    debounced.value = q
  })

  async function run(q: string): Promise<void> {
    const id = ++requestId
    if (q.trim().length < (opts.minLength ?? 0)) {
      results.value = opts.empty
      return
    }
    loading.value = true
    error.value = null
    try {
      const next = await fetcher(q.trim())
      if (id === requestId) results.value = next
    } catch (err) {
      if (id === requestId) error.value = errorMessage(err)
    } finally {
      if (id === requestId) loading.value = false
    }
  }
  watch(debounced, (q) => void run(q))

  return { query, results, loading, error, refresh: () => run(debounced.value) }
}
