import { useRouter } from 'vue-router'

import { usePushSubscription } from '@/composables/usePushSubscription'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useNotificationsStore } from '@/stores/notifications'
import { useUpcomingStore } from '@/stores/upcoming'
import { useWatchedStore } from '@/stores/watched'

/**
 * Sign out everywhere the same way: forget this device's push registration, clear every
 * per-user store so the next account never sees stale data, then go to the login page.
 */
export function useSignOut() {
  const router = useRouter()
  const auth = useAuthStore()
  const push = usePushSubscription()

  return async function signOut(): Promise<void> {
    await push.forgetDevice().catch(() => undefined)
    useNotificationsStore().reset()
    useLibraryStore().reset()
    useWatchedStore().reset()
    useUpcomingStore().reset()
    await auth.signOut()
    await router.replace({ name: 'login' })
  }
}
