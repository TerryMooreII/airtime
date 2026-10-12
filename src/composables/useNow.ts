import { onBeforeUnmount, onMounted, ref } from 'vue'

/** A reactive "now" that ticks every `intervalMs` while the component is mounted. */
export function useNow(intervalMs = 30_000) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    now.value = Date.now()
    timer = setInterval(() => (now.value = Date.now()), intervalMs)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return now
}
