import { useAuthStore } from '@/stores/auth'

/**
 * The signed-in user's id from the auth store (no network round trip; the store keeps the
 * session current). RLS still enforces ownership server-side.
 */
export function requireUserId(): string {
  const id = useAuthStore().user?.id
  if (!id) throw new Error('not signed in')
  return id
}
