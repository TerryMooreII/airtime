/**
 * push-dispatch: sends Web Push messages for notifications that have not been
 * pushed yet. Invoked by pg_cron (and by send_test_notification) with the sync secret.
 *
 * claim_push_batch() stamps push_sent_at atomically (FOR UPDATE SKIP LOCKED), so two
 * overlapping dispatchers never send the same row twice, and rows for users with push
 * turned off are never claimed.
 *
 * Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com)
 */
import webpush from 'npm:web-push@3.6.7'
import { json } from '../_shared/cors.ts'
import { requireInternal } from '../_shared/auth.ts'
import { serve } from '../_shared/serve.ts'
import { env, serviceClient, unwrap } from '../_shared/supabase.ts'
import { chunk } from '../_shared/tvmaze.ts'

const BATCH = 200
const CONCURRENCY = 20

interface PendingNotification {
  id: number
  user_id: string
  title: string
  body: string | null
  show_id: number | null
  data: Record<string, unknown>
}

interface Subscription {
  id: number
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

serve('push-dispatch', async (req) => {
  await requireInternal(req)
  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  const db = serviceClient()

  const pending = unwrap(
    await db.rpc('claim_push_batch', { p_limit: BATCH }),
    'claim_push_batch',
  ) as PendingNotification[]
  if (!pending.length) return json({ sent: 0, pending: 0 })

  const userIds = [...new Set(pending.map((n) => n.user_id))]
  const subs = unwrap(
    await db
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', userIds)
      .is('failed_at', null),
    'push subscriptions',
  ) as Subscription[]
  const subsByUser = new Map<string, Subscription[]>()
  for (const s of subs) subsByUser.set(s.user_id, [...(subsByUser.get(s.user_id) ?? []), s])

  const sends: { sub: Subscription; payload: string }[] = []
  for (const n of pending) {
    const payload = JSON.stringify({
      title: n.title,
      body: n.body ?? '',
      // No default icon: the service worker falls back to the app icon under its own base path.
      icon: (n.data?.image as string | undefined) ?? undefined,
      url: n.show_id ? `/shows/${n.show_id}` : '/notifications',
      notificationId: n.id,
    })
    for (const sub of subsByUser.get(n.user_id) ?? []) sends.push({ sub, payload })
  }

  let sent = 0
  const okSubscriptionIds = new Set<number>()
  const deadSubscriptionIds = new Set<number>()
  for (const batch of chunk(sends, CONCURRENCY)) {
    const results = await Promise.allSettled(
      batch.map(({ sub, payload }) =>
        deadSubscriptionIds.has(sub.id)
          ? Promise.reject(new Error('dead'))
          : webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
              { TTL: 60 * 60 * 24 },
            ),
      ),
    )
    results.forEach((r, i) => {
      const sub = batch[i].sub
      if (r.status === 'fulfilled') {
        sent++
        okSubscriptionIds.add(sub.id)
        return
      }
      const status = (r.reason as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) deadSubscriptionIds.add(sub.id)
      else if ((r.reason as Error).message !== 'dead')
        console.error(`push to subscription ${sub.id} failed`, r.reason)
    })
  }

  const now = new Date().toISOString()
  if (deadSubscriptionIds.size)
    unwrap(
      await db
        .from('push_subscriptions')
        .update({ failed_at: now })
        .in('id', [...deadSubscriptionIds]),
      'mark dead subscriptions',
    )
  if (okSubscriptionIds.size)
    unwrap(
      await db
        .from('push_subscriptions')
        .update({ last_success_at: now })
        .in('id', [...okSubscriptionIds]),
      'mark successful subscriptions',
    )

  return json({ pending: pending.length, sent, expired: deadSubscriptionIds.size })
})
