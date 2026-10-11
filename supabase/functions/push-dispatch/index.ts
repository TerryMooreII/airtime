/**
 * push-dispatch: sends Web Push messages for notifications that have not been
 * pushed yet. Invoked by pg_cron with the service-role key.
 *
 * Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com)
 */
import webpush from 'npm:web-push@3.6.7'
import { handleOptions, json } from '../_shared/cors.ts'
import { HttpError, requireInternal } from '../_shared/auth.ts'
import { env, serviceClient, unwrap } from '../_shared/supabase.ts'

const BATCH = 200

interface PendingNotification {
  id: number
  user_id: string
  title: string
  body: string | null
  show_id: number | null
  data: Record<string, unknown>
  profiles: { notify_push: boolean } | null
}

interface Subscription {
  id: number
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options

  try {
    await requireInternal(req)
    webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
    const db = serviceClient()

    const pending = unwrap(
      await db
        .from('notifications')
        .select('id, user_id, title, body, show_id, data, profiles!inner(notify_push)')
        .is('push_sent_at', null)
        .order('id')
        .limit(BATCH),
      'pending notifications',
    ) as unknown as PendingNotification[]

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

    let sent = 0
    let expired = 0
    const deadSubscriptionIds = new Set<number>()

    for (const n of pending) {
      const targets = n.profiles?.notify_push ? (subsByUser.get(n.user_id) ?? []) : []
      const payload = JSON.stringify({
        title: n.title,
        body: n.body ?? '',
        // No default icon: the service worker falls back to the app icon under its own base path.
        icon: (n.data?.image as string | undefined) ?? undefined,
        url: n.show_id ? `/shows/${n.show_id}` : '/notifications',
        notificationId: n.id,
      })
      for (const sub of targets) {
        if (deadSubscriptionIds.has(sub.id)) continue
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60 * 60 * 24 },
          )
          sent++
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            deadSubscriptionIds.add(sub.id)
            expired++
          } else {
            console.error(`push to subscription ${sub.id} failed`, err)
          }
        }
      }
    }

    const now = new Date().toISOString()
    await db
      .from('notifications')
      .update({ push_sent_at: now })
      .in(
        'id',
        pending.map((n) => n.id),
      )
    if (deadSubscriptionIds.size) {
      await db
        .from('push_subscriptions')
        .update({ failed_at: now })
        .in('id', [...deadSubscriptionIds])
    }
    if (sent) {
      const okIds = subs.filter((s) => !deadSubscriptionIds.has(s.id)).map((s) => s.id)
      if (okIds.length)
        await db.from('push_subscriptions').update({ last_success_at: now }).in('id', okIds)
    }

    return json({ pending: pending.length, sent, expired })
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    console.error('push-dispatch failed', err)
    return json({ error: err instanceof Error ? err.message : 'error' }, status)
  }
})
