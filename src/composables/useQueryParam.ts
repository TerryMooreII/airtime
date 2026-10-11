import { ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface Options<T extends string | number> {
  defaultValue: T
  /** Turns a raw query string into a valid value, or undefined to ignore it. */
  parse: (raw: string) => T | undefined
  /** Also keep the last value in localStorage under this key, used when the URL has none. */
  remember?: string
}

/**
 * A ref mirrored into the current route's query string, so filters survive a refresh and
 * the back button. The default value is left out of the URL to keep links short.
 */
export function useQueryParam<T extends string | number>(name: string, opts: Options<T>): Ref<T> {
  const route = useRoute()
  const router = useRouter()

  const fromRaw = (raw: unknown): T | undefined =>
    typeof raw === 'string' ? opts.parse(raw) : undefined
  const stored = (): T | undefined => {
    if (!opts.remember) return undefined
    try {
      const raw = localStorage.getItem(opts.remember)
      return raw == null ? undefined : opts.parse(raw)
    } catch {
      return undefined
    }
  }

  const value = ref(fromRaw(route.query[name]) ?? stored() ?? opts.defaultValue) as Ref<T>

  // URL → state (back / forward navigation).
  watch(
    () => route.query[name],
    (raw) => {
      const next = fromRaw(raw) ?? stored() ?? opts.defaultValue
      if (next !== value.value) value.value = next
    },
  )

  // State → URL (+ storage). Replace, not push: the page stays one history entry.
  watch(value, (v) => {
    if (opts.remember) {
      try {
        localStorage.setItem(opts.remember, String(v))
      } catch {
        /* ignore */
      }
    }
    const next = v === opts.defaultValue ? undefined : String(v)
    if ((route.query[name] ?? undefined) === next) return
    void router.replace({ query: { ...route.query, [name]: next } })
  })

  return value
}
