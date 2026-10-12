<script setup lang="ts" generic="S extends string">
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'

import AFollowButton from './AFollowButton.vue'
import APoster from './APoster.vue'
import AStarRating from './AStarRating.vue'

export interface FollowOption<S extends string = string> {
  value: S
  label: string
}

/**
 * Poster card used in Search, Discover rails and the Library grid.
 * Emits `follow` when the chip is pressed (with the chosen status when `followOptions` are
 * given); rating is a v-model.
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
    /** Statuses offered in the "Add as" menu; without them the plus follows directly. */
    followOptions?: FollowOption<S>[]
    showRating?: boolean
    /** Fixed-width card for horizontal rails (var(--rail-w)). */
    rail?: boolean
  }>(),
  { following: false, followLoading: false, showFollow: true, showRating: false },
)
const emit = defineEmits<{ follow: [status?: S] }>()

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
/** Plus: expand the circle into the status panel (or follow directly). Check: unfollow. */
function onChip(isFollowing: boolean, hasOptions: boolean) {
  if (isFollowing || !hasOptions) emit('follow')
  else if (menuOpen.value) closeMenu()
  else openMenu()
}
function choose(status: S, ev: Event) {
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
    :class="{ 'a-show-card--no-follow': !showFollow, 'a-show-card--rail': rail }"
  >
    <APoster :src="image" :alt="name" radius="lg">
      <span v-if="badge" class="a-show-card__badge">{{ badge }}</span>
    </APoster>
    <!-- Outside the poster so its overflow clipping cannot cut the open panel off. -->
    <span
      v-if="showFollow"
      ref="followEl"
      class="a-show-card__follow"
      :class="{ 'a-show-card__follow--open': menuOpen }"
    >
      <span class="a-show-card__panel" role="menu" :aria-hidden="!menuOpen" @click.prevent.stop>
        <span class="a-show-card__panel-title">Add as</span>
        <button
          v-for="(o, i) in followOptions ?? []"
          :key="o.value"
          type="button"
          role="menuitem"
          class="a-show-card__panel-item"
          :style="{ '--stagger': menuOpen ? `${90 + i * 45}ms` : '0ms' }"
          :tabindex="menuOpen ? 0 : -1"
          @click="choose(o.value, $event)"
        >
          {{ o.label }}
        </button>
      </span>
      <AFollowButton
        appearance="chip"
        inline
        :following="following"
        :loading="followLoading"
        :open="menuOpen"
        @toggle="onChip(following, !!followOptions?.length)"
      />
    </span>
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
  position: relative;
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
.a-show-card--rail {
  width: var(--rail-w);
  flex: none;
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
  font: 600 var(--text-2xs) var(--font-mono);
  background: var(--primary);
  color: var(--on-primary);
  padding: 4px 7px;
  border-radius: var(--radius-badge);
  z-index: 1;
}
.a-show-card--no-follow .a-show-card__badge {
  max-width: calc(100% - 16px);
}
/* Spans the poster's top strip so the panel can size against the card, not the 34px chip.
   Only the chip and the open panel take clicks; the rest falls through to the card link. */
.a-show-card__follow {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 8px;
  z-index: 2;
  height: 34px;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}
.a-show-card__follow > :deep(.a-follow-chip) {
  pointer-events: auto;
}
/* The circle behind the plus; grows into the options panel. */
.a-show-card__panel {
  position: absolute;
  right: 0;
  top: 0;
  /* Preferred width, but never wider than the card (rail cards are 156px / 132px). */
  width: min(168px, 100%);
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  padding: 0 6px 6px;
  border-radius: 17px;
  /* Always dark glass: it sits on top of artwork in either theme. */
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  color: var(--glass-fg);
  box-shadow: var(--shadow-drawer);
  clip-path: circle(17px at calc(100% - 17px) 17px);
  pointer-events: none;
  transition: clip-path var(--dur-slow) var(--ease);
}
.a-show-card__follow--open .a-show-card__panel {
  clip-path: circle(230px at calc(100% - 17px) 17px);
  pointer-events: auto;
}
/* Sits on the same row as the plus / x, which occupies the right 34px. */
.a-show-card__panel-title {
  height: 34px;
  display: flex;
  align-items: center;
  padding: 0 40px 0 10px;
  margin-bottom: var(--space-0_5);
  font: 600 var(--text-2xs) var(--font-mono);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  color: rgba(243, 243, 241, 0.6);
  white-space: nowrap;
}
.a-show-card__panel-item {
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font-size: var(--text-sm);
  font-weight: 500;
  padding: var(--space-2) var(--space-2_5);
  border-radius: 10px;
  white-space: nowrap;
  opacity: 0;
  transform: translateX(8px);
  /* Entrance is staggered per item; hover colors switch together with no delay. */
  transition:
    opacity var(--dur) var(--ease) var(--stagger, 0ms),
    transform var(--dur) var(--ease) var(--stagger, 0ms),
    background-color var(--dur-fast) linear 0ms,
    color var(--dur-fast) linear 0ms;
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
.a-show-card__name {
  font-size: var(--text-base);
  font-weight: 600;
  line-height: 1.25;
}
.a-show-card__stars {
  margin: -4px 0 -2px;
}
.a-show-card__meta {
  font: 500 var(--text-xs) var(--font-mono);
  color: var(--muted);
  margin-top: -3px;
}
@media (max-width: 759px) {
  .a-show-card--rail {
    width: var(--rail-w-mobile);
  }
}
</style>
