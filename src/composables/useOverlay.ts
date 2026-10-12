import { onBeforeUnmount, watch, type Ref } from 'vue'

/**
 * Shared behaviour of modal surfaces: Escape closes, and optionally the page behind stops
 * scrolling while open. Listeners are removed when the overlay closes or unmounts.
 */
export function useOverlay(
  open: Ref<boolean>,
  onClose: () => void,
  opts: { lockScroll?: boolean } = {},
) {
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }
  function attach() {
    document.addEventListener('keydown', onKey)
    if (opts.lockScroll) document.body.style.overflow = 'hidden'
  }
  function detach() {
    document.removeEventListener('keydown', onKey)
    if (opts.lockScroll) document.body.style.overflow = ''
  }
  watch(open, (isOpen) => (isOpen ? attach() : detach()), { immediate: true })
  onBeforeUnmount(detach)
}
