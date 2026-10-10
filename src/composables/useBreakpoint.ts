import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

const MOBILE_QUERY = '(max-width: 759px)'
const isMobile = ref(typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false)
let listeners = 0
let mq: MediaQueryList | null = null
const handler = (e: MediaQueryListEvent) => (isMobile.value = e.matches)

/** Shared reactive breakpoint matching the mock's 760px desktop/mobile switch. */
export function useBreakpoint() {
  onMounted(() => {
    if (listeners++ === 0) {
      mq = window.matchMedia(MOBILE_QUERY)
      isMobile.value = mq.matches
      mq.addEventListener('change', handler)
    }
  })
  onBeforeUnmount(() => {
    if (--listeners === 0 && mq) {
      mq.removeEventListener('change', handler)
      mq = null
    }
  })
  return { isMobile: readonly(isMobile) }
}
