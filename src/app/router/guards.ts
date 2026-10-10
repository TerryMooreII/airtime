import type { NavigationGuardWithThis } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Route requires a signed-in (and email-verified) user. */
    requiresAuth?: boolean
    /** Route requires the admin role. */
    requiresAdmin?: boolean
    /** Route is only for signed-out visitors (login, register...). */
    guestOnly?: boolean
    /** Page title suffix. */
    title?: string
    /** Which layout wraps the view. */
    layout?: 'app' | 'auth' | 'admin' | 'blank'
  }
}

export const authGuard: NavigationGuardWithThis<undefined> = async (to) => {
  const auth = useAuthStore()
  await auth.init()

  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'home' }

  if (to.meta.requiresAuth || to.meta.requiresAdmin) {
    if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
    if (!auth.isEmailVerified && to.name !== 'verify-email') return { name: 'verify-email' }
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) return { name: 'home' }
  return true
}

export function applyTitle(title?: string): void {
  document.title = title ? `${title} · Airtime` : 'Airtime'
}
