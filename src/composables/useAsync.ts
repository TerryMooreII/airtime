import { ref, shallowRef } from 'vue'

/** Tracks loading / error state around an async function. */
export function useAsync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const data = shallowRef<TResult | null>(null)

  async function run(...args: TArgs): Promise<TResult | undefined> {
    loading.value = true
    error.value = null
    try {
      data.value = await fn(...args)
      return data.value
    } catch (err) {
      error.value = errorMessage(err)
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, error, data, run }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err && 'message' in err)
    return String((err as { message: unknown }).message)
  return 'Something went wrong'
}
