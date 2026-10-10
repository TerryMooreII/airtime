/**
 * admin-users: user management that needs the Auth admin API.
 * Body: { action: 'list', page?, perPage? } | { action: 'ban' | 'unban' | 'delete', userId }
 */
import { handleOptions, json } from '../_shared/cors.ts'
import { HttpError, requireAdmin } from '../_shared/auth.ts'

type Body =
  | { action: 'list'; page?: number; perPage?: number }
  | { action: 'ban' | 'unban' | 'delete'; userId: string }

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options

  try {
    const { user, asService } = await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as Body

    switch (body.action) {
      case 'list': {
        const page = Math.max(1, Number(body.page ?? 1))
        const perPage = Math.min(100, Math.max(1, Number(body.perPage ?? 50)))
        const { data, error } = await asService.auth.admin.listUsers({ page, perPage })
        if (error) throw new HttpError(500, error.message)

        const ids = data.users.map((u) => u.id)
        const { data: profiles } = await asService
          .from('profiles')
          .select('id, display_name, role, timezone, created_at')
          .in('id', ids)
        const { data: counts } = await asService.from('user_shows').select('user_id').in('user_id', ids)
        const trackedByUser = new Map<string, number>()
        for (const row of counts ?? []) trackedByUser.set(row.user_id, (trackedByUser.get(row.user_id) ?? 0) + 1)
        const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

        return json({
          page,
          perPage,
          total: data.total ?? null,
          users: data.users.map((u) => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            email_confirmed_at: u.email_confirmed_at,
            banned_until: (u as { banned_until?: string }).banned_until ?? null,
            display_name: profileById.get(u.id)?.display_name ?? null,
            role: profileById.get(u.id)?.role ?? 'user',
            tracked_shows: trackedByUser.get(u.id) ?? 0,
          })),
        })
      }
      case 'ban':
      case 'unban': {
        if (body.userId === user.id) throw new HttpError(400, 'cannot ban yourself')
        const { error } = await asService.auth.admin.updateUserById(body.userId, {
          ban_duration: body.action === 'ban' ? '876000h' : 'none',
        })
        if (error) throw new HttpError(500, error.message)
        return json({ ok: true })
      }
      case 'delete': {
        if (body.userId === user.id) throw new HttpError(400, 'cannot delete yourself')
        const { error } = await asService.auth.admin.deleteUser(body.userId)
        if (error) throw new HttpError(500, error.message)
        return json({ ok: true })
      }
      default:
        throw new HttpError(400, 'unknown action')
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    console.error('admin-users failed', err)
    return json({ error: err instanceof Error ? err.message : 'error' }, status)
  }
})
