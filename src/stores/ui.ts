import { defineStore } from 'pinia'
import { ref } from 'vue'

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

  return {
    toasts,
    toast,
    dismiss,
    success: (m: string) => toast(m, 'success'),
    error: (m: string) => toast(m, 'error', 6000),
  }
})
