<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'

import AFollowButton from './AFollowButton.vue'
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
let closeTimer: ReturnType<typeof setTimeout> | undefined

function openMenu() {
  clearTimeout(closeTimer)
  menuOpen.value = true
}
function scheduleClose() {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => (menuOpen.value = false), 160)
}
function onChipToggle(props: { following: boolean }) {
  // Following -> unfollow directly. Not following -> open the status menu (tap on touch screens).
  if (props.following) emit('follow')
  else menuOpen.value = !menuOpen.value
}
function choose(status: FollowStatus, ev: Event) {
  ev.preventDefault()
  ev.stopPropagation()
  menuOpen.value = false
  emit('follow', status)
}
onBeforeUnmount(() => clearTimeout(closeTimer))
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
        class="a-show-card__follow"
        :class="{ 'a-show-card__follow--open': menuOpen }"
        @mouseenter="!following && openMenu()"
        @mouseleave="scheduleClose()"
      >
        <AFollowButton
          :following="following"
          :loading="followLoading"
          appearance="chip"
          @toggle="onChipToggle({ following })"
        />
        <span
          v-if="menuOpen && !following"
          class="a-show-card__menu"
          role="menu"
          @click.prevent.stop
        >
          <span class="a-show-card__menu-title">Add as</span>
          <button
            v-for="o in FOLLOW_OPTIONS"
            :key="o.value"
            type="button"
            role="menuitem"
            class="a-show-card__menu-item"
            @click="choose(o.value, $event)"
          >
            {{ o.label }}
          </button>
        </span>
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
}
.a-show-card__follow :deep(.a-follow-chip) {
  position: static;
}
.a-show-card__menu {
  position: absolute;
  right: 0;
  top: 40px;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  padding: 6px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--line2);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  animation: ad-fade-in var(--dur-fast) var(--ease);
}
.a-show-card__menu-title {
  font: 600 10.5px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 4px 8px 6px;
}
.a-show-card__menu-item {
  border: 0;
  background: transparent;
  color: var(--fg);
  text-align: left;
  font-size: 13.5px;
  font-weight: 500;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}
.a-show-card__menu-item:hover,
.a-show-card__menu-item:focus-visible {
  background: var(--primary-soft);
  color: var(--primary-text);
  outline: none;
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
