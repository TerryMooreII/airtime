import { defineStore } from 'pinia'
import { ref } from 'vue'

import { errorMessage } from '@/composables/useAsync'

export interface Toast {
  id: number
  message: string
  variant: 'info' | 'success' | 'error'
  timeout: number
}

let nextId = 1

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])

  function toast(message: string, variant: Toast['variant'] = 'info', timeout = 3500): void {
    const t: Toast = { id: nextId++, message, variant, timeout }
    toasts.value.push(t)
    if (timeout > 0) setTimeout(() => dismiss(t.id), timeout)
  }
  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  const success = (m: string) => toast(m, 'success')
  /** Show an error toast; accepts anything thrown. */
  const error = (err: unknown) => toast(errorMessage(err), 'error', 6000)

  /**
   * Run an action and report failure as a toast (and success, when a message is given).
   * Resolves to undefined on failure so callers can carry on.
   */
  async function attempt<T>(fn: () => Promise<T>, successMessage?: string): Promise<T | undefined> {
    try {
      const result = await fn()
      if (successMessage) success(successMessage)
      return result
    } catch (err) {
      error(err)
      return undefined
    }
  }

  return { toasts, toast, dismiss, success, error, attempt }
})
