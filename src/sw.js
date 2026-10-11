/*
 * Airtime service worker. Built by vite-plugin-pwa (injectManifest):
 *   - precaches the app shell so the installed app opens offline,
 *   - serves index.html for navigations (SPA routing under the deploy base),
 *   - caches poster images and fonts at runtime,
 *   - shows Web Push notifications and opens the app on click.
 */
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// The precache only has entries in a production build; in dev the network serves pages.
if (import.meta.env.PROD) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL(`${import.meta.env.BASE_URL}index.html`), {
      // Never intercept Supabase auth redirects or anything outside the app.
      denylist: [/^\/rest\//, /^\/auth\/v1\//],
    }),
  )
}

// TVmaze posters and cast photos: immutable, so cache-first with a bounded store.
registerRoute(
  ({ url, request }) => request.destination === 'image' && url.hostname.endsWith('tvmaze.com'),
  new CacheFirst({
    cacheName: 'airtime-images',
    plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 30 * 24 * 3600 })],
  }),
)

// Web fonts.
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'airtime-fonts' }),
)

self.addEventListener('push', (event) => {
  // Paths in the payload are app routes ("/shows/1"); resolve them under the deploy base,
  // which is the worker's scope ("/" locally, "/<repo>/" on GitHub Pages).
  const base = self.registration.scope
  let payload = {
    title: 'Airtime',
    body: '',
    url: '/notifications',
    icon: base + 'icons/icon-192.png',
  }
  try {
    payload = { ...payload, ...event.data.json() }
  } catch {
    payload.body = event.data ? event.data.text() : ''
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: base + 'icons/icon-192.png',
      tag: payload.notificationId ? `airtime-${payload.notificationId}` : undefined,
      data: { url: new URL(String(payload.url).replace(/^\//, ''), base).href },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || self.registration.scope
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.startsWith(self.location.origin))
      if (existing) return existing.focus().then((c) => c.navigate(url))
      return self.clients.openWindow(url)
    }),
  )
})
