import { computed, ref, watchEffect } from 'vue'

export type ThemeMode = 'dark' | 'light' | 'system'
const STORAGE_KEY = 'airtime:theme'

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'dark'
}

const mode = ref<ThemeMode>(readStored())
const systemDark = ref(true)
let initialized = false

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = mq.matches
  mq.addEventListener('change', (e) => (systemDark.value = e.matches))
  watchEffect(() => {
    const resolved = mode.value === 'system' ? (systemDark.value ? 'dark' : 'light') : mode.value
    document.documentElement.dataset.theme = resolved
    // Status bar / title bar colour for the installed app follows the page background token.
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
    try {
      localStorage.setItem(STORAGE_KEY, mode.value)
    } catch {
      /* ignore */
    }
  })
}

/** Theme mode persisted per browser (dark is the default, as in the mock). */
export function useTheme() {
  init()
  const resolved = computed(() =>
    mode.value === 'system' ? (systemDark.value ? 'dark' : 'light') : mode.value,
  )
  function toggle() {
    mode.value = resolved.value === 'dark' ? 'light' : 'dark'
  }
  return { mode, resolved, toggle }
}
