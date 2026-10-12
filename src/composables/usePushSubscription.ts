import { computed, ref } from 'vue'

import { supabase } from '@/lib/supabase'
import { BASE_PATH, publicAsset } from '@/lib/url'
import { useAuthStore } from '@/stores/auth'

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
  /**
   * iOS only exposes push inside a Home Screen web app, so a Safari tab reports
   * "unsupported" even though installing the app would enable it.
   */
  const needsHomeScreen = computed(() => {
    if (supported.value || typeof navigator === 'undefined') return false
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const standalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    return ios && !standalone
  })
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

  /** Attach the browser's subscription to the signed-in user (reassigns it on account switch). */
  async function register(sub: PushSubscription): Promise<void> {
    const json = sub.toJSON()
    const { error: err } = await supabase.rpc('register_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: json.keys?.p256dh ?? '',
      p_auth: json.keys?.auth ?? '',
      p_user_agent: navigator.userAgent.slice(0, 200),
    })
    if (err) throw err
  }

  async function browserSubscription(): Promise<PushSubscription | null> {
    if (!supported.value) return null
    const reg = await navigator.serviceWorker.getRegistration(BASE_PATH)
    return (await reg?.pushManager.getSubscription()) ?? null
  }

  /**
   * Sync state with the browser. When the profile has push on and the browser still holds a
   * subscription, re-register it: sign-out removes the server row, so this makes the same
   * account's next sign-in work without touching the toggle.
   */
  async function refresh(): Promise<void> {
    if (!supported.value) return
    const sub = await browserSubscription()
    subscribed.value = Boolean(sub)
    permission.value = Notification.permission
    const auth = useAuthStore()
    if (sub && auth.user && auth.profile?.notify_push) await register(sub).catch(() => undefined)
  }

  /** Remove this device's registration for the signed-in user (keeps the browser subscription). */
  async function forgetDevice(): Promise<void> {
    const sub = await browserSubscription()
    if (sub) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
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
      await register(sub)
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
      const reg = await navigator.serviceWorker.getRegistration(BASE_PATH)
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

  return {
    supported,
    configured,
    needsHomeScreen,
    permission,
    subscribed,
    busy,
    error,
    refresh,
    forgetDevice,
    enable,
    disable,
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
