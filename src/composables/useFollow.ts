import { reactive } from 'vue'

import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import type { UserShowStatus } from '@/types/domain'

/** Follow / unfollow a show with per-show pending state and toasts. */
export function useFollow() {
  const library = useLibraryStore()
  const ui = useUiStore()
  const pendingIds = reactive(new Set<number>())

  function isFollowing(showId: number): boolean {
    return library.byShowId.has(showId)
  }
  function pending(showId: number): boolean {
    return pendingIds.has(showId)
  }

  async function toggle(
    showId: number,
    tvmazeId?: number,
    name?: string,
    status: UserShowStatus = 'watching',
  ): Promise<void> {
    if (pendingIds.has(showId)) return
    pendingIds.add(showId)
    try {
      if (isFollowing(showId)) {
        await library.untrack(showId)
        ui.toast(name ? `Removed ${name} from your library` : 'Removed from your library')
      } else {
        await library.track(showId, tvmazeId, status)
        ui.success(name ? `Following ${name}` : 'Added to your library')
      }
    } catch (err) {
      ui.error(err)
    } finally {
      pendingIds.delete(showId)
    }
  }

  return { isFollowing, pending, toggle }
}
