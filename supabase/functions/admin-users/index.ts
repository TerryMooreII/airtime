/**
 * admin-users: user management that needs the Auth admin API.
 * Body: { action: 'list', page?, perPage? } | { action: 'ban' | 'unban' | 'delete', userId }
 */
import { json } from '../_shared/cors.ts'
import { HttpError, requireAdmin } from '../_shared/auth.ts'
import { serve } from '../_shared/serve.ts'
import { unwrap } from '../_shared/supabase.ts'

type Body =
  | { action: 'list'; page?: number; perPage?: number }
  | { action: 'ban' | 'unban' | 'delete'; userId: string }

interface UserSummary {
  id: string
  display_name: string | null
  role: 'user' | 'admin'
  tracked_shows: number
}

serve('admin-users', async (req) => {
  const { user, asService } = await requireAdmin(req)
  const body = (await req.json().catch(() => ({}))) as Body

  switch (body.action) {
    case 'list': {
      const page = Math.max(1, Number(body.page ?? 1))
      const perPage = Math.min(100, Math.max(1, Number(body.perPage ?? 50)))
      const { data, error } = await asService.auth.admin.listUsers({ page, perPage })
      if (error) throw new HttpError(500, error.message)

      const ids = data.users.map((u) => u.id)
      // One set-based RPC: profile fields plus follow counts (no per-row download, no 1,000-row cap).
      const summaries = unwrap(
        await asService.rpc('admin_user_summaries', { p_ids: ids }),
        'admin_user_summaries',
      ) as UserSummary[]
      const profileById = new Map(summaries.map((p) => [p.id, p]))

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
          tracked_shows: Number(profileById.get(u.id)?.tracked_shows ?? 0),
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
})
