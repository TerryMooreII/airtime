import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import type { UserShowStatus } from '@/types/domain'

interface ShowRef {
  id: number
  tvmaze_id: number
}

/** Rate, re-status or mute a show, with errors reported as toasts. Shared by the show page and the Library. */
export function useLibraryActions() {
  const library = useLibraryStore()
  const ui = useUiStore()

  /** Rating a show that is not tracked yet adds it as completed. */
  function rate(show: ShowRef, rating: number | null): Promise<void | undefined> {
    const patch = library.entryFor(show.id) ? { rating } : { rating, status: 'completed' as const }
    return ui.attempt(() => library.update(show.id, patch, show.tvmaze_id))
  }
  function setStatus(show: ShowRef, status: UserShowStatus): Promise<void | undefined> {
    return ui.attempt(() => library.update(show.id, { status }, show.tvmaze_id))
  }
  function setNotify(show: ShowRef, notify: boolean): Promise<void | undefined> {
    return ui.attempt(
      () => library.update(show.id, { notify }, show.tvmaze_id),
      notify ? 'Alerts on for this show' : 'Alerts muted for this show',
    )
  }

  return { rate, setStatus, setNotify }
}
