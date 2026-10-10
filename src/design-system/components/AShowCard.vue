<script setup lang="ts">
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
const emit = defineEmits<{ follow: [] }>()
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
      <AFollowButton
        v-if="showFollow"
        :following="following"
        :loading="followLoading"
        appearance="chip"
        @toggle="emit('follow')"
      />
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
