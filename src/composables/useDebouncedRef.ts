import { customRef, type Ref } from 'vue'

export function useDebouncedRef<T>(initial: T, delay = 250): Ref<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let value = initial
  return customRef<T>((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(next) {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        value = next
        trigger()
      }, delay)
    },
  }))
}
