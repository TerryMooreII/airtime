<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'

import AIcon from './AIcon.vue'
import APoster from './APoster.vue'
import AStarRating from './AStarRating.vue'

/**
 * Poster card used in Search, Discover rails and the Library grid.
 * Emits `follow` when the chip is pressed; rating is a v-model.
 */
withDefaults(
  defineProps<{
    showId: number
    name: string
    image: string | null | undefined
    meta?: string
    badge?: string
    following?: boolean
    followLoading?: boolean
    showFollow?: boolean
    showRating?: boolean
    /** Fixed width for horizontal rails. */
    width?: string
  }>(),
  { following: false, followLoading: false, showFollow: true, showRating: false },
)
const emit = defineEmits<{ follow: [status?: FollowStatus] }>()

/** Status choices offered when following from a card. */
export type FollowStatus = 'watching' | 'plan_to_watch' | 'completed'
const FOLLOW_OPTIONS: { value: FollowStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'plan_to_watch', label: 'Plan to watch' },
  { value: 'completed', label: 'Completed' },
]

const menuOpen = ref(false)
const followEl = ref<HTMLElement | null>(null)

function onDocumentClick(ev: MouseEvent) {
  if (menuOpen.value && followEl.value && !followEl.value.contains(ev.target as Node)) closeMenu()
}
function onDocumentKey(ev: KeyboardEvent) {
  if (ev.key === 'Escape') closeMenu()
}
function openMenu() {
  menuOpen.value = true
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onDocumentKey)
}
function closeMenu() {
  menuOpen.value = false
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('keydown', onDocumentKey)
}
/** Plus: expand the circle into the status panel. Check: unfollow directly. */
function onChipClick(ev: Event, isFollowing: boolean) {
  ev.preventDefault()
  ev.stopPropagation()
  if (isFollowing) emit('follow')
  else if (menuOpen.value) closeMenu()
  else openMenu()
}
function choose(status: FollowStatus, ev: Event) {
  ev.preventDefault()
  ev.stopPropagation()
  closeMenu()
  emit('follow', status)
}
onBeforeUnmount(closeMenu)
const rating = defineModel<number | null>('rating', { default: null })
</script>

<template>
  <RouterLink
    :to="{ name: 'show', params: { id: showId } }"
    class="a-show-card"
    :class="{ 'a-show-card--no-follow': !showFollow }"
    :style="width ? { width, flex: 'none' } : undefined"
  >
    <APoster :src="image" :alt="name" radius="lg">
      <span v-if="badge" class="a-show-card__badge">{{ badge }}</span>
      <span
        v-if="showFollow"
        ref="followEl"
        class="a-show-card__follow"
        :class="{ 'a-show-card__follow--open': menuOpen }"
      >
        <span class="a-show-card__panel" role="menu" :aria-hidden="!menuOpen" @click.prevent.stop>
          <span class="a-show-card__panel-title">Add as</span>
          <button
            v-for="(o, i) in FOLLOW_OPTIONS"
            :key="o.value"
            type="button"
            role="menuitem"
            class="a-show-card__panel-item"
            :style="{ transitionDelay: menuOpen ? `${90 + i * 45}ms` : '0ms' }"
            :tabindex="menuOpen ? 0 : -1"
            @click="choose(o.value, $event)"
          >
            {{ o.label }}
          </button>
        </span>
        <button
          type="button"
          class="a-show-card__chip"
          :class="{ 'a-show-card__chip--on': following, 'a-show-card__chip--open': menuOpen }"
          :aria-label="following ? 'Unfollow' : menuOpen ? 'Close' : 'Follow'"
          :aria-expanded="following ? undefined : menuOpen"
          :disabled="followLoading"
          @click="onChipClick($event, following)"
        >
          <AIcon
            :name="followLoading ? 'spinner' : following ? 'check' : 'plus'"
            :size="16"
            :stroke-width="2.4"
          />
        </button>
      </span>
    </APoster>
    <span class="a-show-card__name truncate">{{ name }}</span>
    <AStarRating
      v-if="showRating"
      v-model="rating"
      size="sm"
      class="a-show-card__stars"
      @click.prevent
    />
    <span v-if="meta" class="a-show-card__meta truncate">{{ meta }}</span>
  </RouterLink>
</template>

<style scoped>
.a-show-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  color: var(--fg);
  text-decoration: none;
}
.a-show-card:hover {
  color: var(--fg);
}
.a-show-card:hover :deep(.a-poster__img) {
  filter: brightness(1.06);
}
.a-show-card__badge {
  position: absolute;
  left: 8px;
  top: 8px;
  /* Never run into the follow chip (34px + 8px margin) on the right. */
  max-width: calc(100% - 58px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font: 600 11px var(--font-mono);
  background: var(--primary);
  color: var(--on-primary);
  padding: 4px 7px;
  border-radius: 6px;
  z-index: 1;
}
.a-show-card--no-follow .a-show-card__badge {
  max-width: calc(100% - 16px);
}
.a-show-card__follow {
  position: absolute;
  right: 8px;
  top: 8px;
  z-index: 2;
  width: 34px;
  height: 34px;
}
/* The circle behind the plus; grows into the options panel. */
.a-show-card__panel {
  position: absolute;
  right: 0;
  top: 0;
  width: 168px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 44px 6px 6px;
  border-radius: 17px;
  background: rgba(20, 20, 22, 0.92);
  backdrop-filter: blur(10px);
  color: #f3f3f1;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  clip-path: circle(17px at calc(100% - 17px) 17px);
  pointer-events: none;
  transition: clip-path 360ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.a-show-card__follow--open .a-show-card__panel {
  clip-path: circle(230px at calc(100% - 17px) 17px);
  pointer-events: auto;
}
.a-show-card__panel-title {
  font: 600 10.5px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(243, 243, 241, 0.6);
  padding: 2px 10px 4px;
}
.a-show-card__panel-item {
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font-size: 13.5px;
  font-weight: 500;
  padding: 8px 10px;
  border-radius: 10px;
  white-space: nowrap;
  opacity: 0;
  transform: translateX(8px);
  transition:
    opacity 220ms var(--ease),
    transform 220ms var(--ease),
    background 120ms;
}
.a-show-card__follow--open .a-show-card__panel-item {
  opacity: 1;
  transform: none;
}
.a-show-card__panel-item:hover,
.a-show-card__panel-item:focus-visible {
  background: var(--primary);
  color: var(--on-primary);
  outline: none;
}
/* The chip stays on top: a plus that turns into an x while the panel is open. */
.a-show-card__chip {
  position: absolute;
  right: 0;
  top: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 0;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
  transition:
    transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background 160ms;
}
.a-show-card__chip:hover {
  transform: scale(1.06);
}
.a-show-card__chip--open {
  background: transparent;
  transform: rotate(135deg);
}
.a-show-card__chip--on {
  background: var(--primary);
  color: var(--on-primary);
}
.a-show-card__chip:disabled {
  opacity: 0.7;
}
.a-show-card__name {
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.25;
}
.a-show-card__stars {
  margin: -4px 0 -2px;
}
.a-show-card__meta {
  font: 500 12px var(--font-mono);
  color: var(--muted);
  margin-top: -3px;
}
</style>
