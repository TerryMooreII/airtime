/* Airtime service worker: displays Web Push notifications and opens the app on click. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = { title: 'Airtime', body: '', url: '/notifications', icon: '/favicon.svg' }
  try {
    payload = { ...payload, ...event.data.json() }
  } catch {
    payload.body = event.data ? event.data.text() : ''
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: '/favicon.svg',
      tag: payload.notificationId ? `airtime-${payload.notificationId}` : undefined,
      data: { url: payload.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.startsWith(self.location.origin))
      if (existing) return existing.focus().then((c) => c.navigate(url))
      return self.clients.openWindow(url)
    }),
  )
})
