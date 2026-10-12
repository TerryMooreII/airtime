import { ref, type Ref } from 'vue'

import { useUiStore } from '@/stores/ui'

/**
 * One in-flight action at a time, keyed by what it acts on (a row id, a job name), with the
 * success toast and error toast handled here. Used by the admin pages.
 */
export function useBusyAction<K extends string | number>() {
  const ui = useUiStore()
  const busy = ref<K | null>(null) as Ref<K | null>

  async function run<R>(
    key: K,
    fn: () => Promise<R>,
    successMessage?: string | ((result: R) => string),
    after?: () => Promise<unknown> | void,
  ): Promise<void> {
    busy.value = key
    try {
      const result = await fn()
      if (successMessage)
        ui.success(typeof successMessage === 'function' ? successMessage(result) : successMessage)
      await after?.()
    } catch (err) {
      ui.error(err)
    } finally {
      busy.value = null
    }
  }

  return { busy, run }
}
