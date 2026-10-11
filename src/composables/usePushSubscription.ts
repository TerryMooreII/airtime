import { computed, ref } from 'vue'

import { supabase } from '@/lib/supabase'
import { BASE_PATH, publicAsset } from '@/lib/url'

/**
 * Web Push subscription management. The service worker (src/sw.js, registered by
 * vite-plugin-pwa) lives at <base>/sw.js and the
 * VAPID public key comes from VITE_VAPID_PUBLIC_KEY.
 */
export function usePushSubscription() {
  const supported = computed(
    () =>
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window,
  )
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
  const configured = computed(() => supported.value && vapidKey.length > 0)
  const permission = ref<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )
  const subscribed = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)

  async function registration(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration(BASE_PATH)
    return (
      existing ??
      (await navigator.serviceWorker.register(publicAsset('sw.js'), { scope: BASE_PATH }))
    )
  }

  async function refresh(): Promise<void> {
    if (!supported.value) return
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = await reg?.pushManager.getSubscription()
    subscribed.value = Boolean(sub)
    permission.value = Notification.permission
  }

  async function enable(): Promise<boolean> {
    if (!configured.value) {
      error.value = 'Push notifications are not configured for this app.'
      return false
    }
    busy.value = true
    error.value = null
    try {
      permission.value = await Notification.requestPermission()
      if (permission.value !== 'granted') {
        error.value = 'Notification permission was not granted.'
        return false
      }
      const reg = await registration()
      await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }))
      const json = sub.toJSON()
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('not signed in')
      const { error: err } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: userData.user.id,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
          user_agent: navigator.userAgent.slice(0, 200),
          failed_at: null,
        },
        { onConflict: 'endpoint' },
      )
      if (err) throw err
      subscribed.value = true
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not enable push notifications'
      return false
    } finally {
      busy.value = false
    }
  }

  async function disable(): Promise<void> {
    busy.value = true
    error.value = null
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      subscribed.value = false
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not disable push notifications'
    } finally {
      busy.value = false
    }
  }

  return { supported, configured, permission, subscribed, busy, error, refresh, enable, disable }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
