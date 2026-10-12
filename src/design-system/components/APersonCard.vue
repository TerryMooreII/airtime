<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import AAvatar from './AAvatar.vue'
import ABadge from './ABadge.vue'

/** Circular headshot + name + role, used for cast lists. */
withDefaults(
  defineProps<{
    name: string
    image: string | null | undefined
    role?: string
    tag?: string
    to?: RouteLocationRaw
    size?: number
  }>(),
  { size: 76 },
)
const failed = ref(false)
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    :to="to"
    class="a-person"
    :class="{ 'a-person--link': !!to }"
  >
    <span class="a-person__photo" :style="{ width: `${size}px`, height: `${size}px` }">
      <img
        v-if="image && !failed"
        :src="image"
        :alt="name"
        loading="lazy"
        decoding="async"
        class="a-person__img"
        @error="failed = true"
      />
      <AAvatar v-else :name="name" :size="size" />
    </span>
    <span class="a-person__name">{{ name }}</span>
    <span v-if="role" class="a-person__role">{{ role }}</span>
    <ABadge v-if="tag" variant="muted" class="a-person__tag">{{ tag }}</ABadge>
  </component>
</template>

<style scoped>
.a-person {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1_5);
  text-align: center;
  color: var(--fg);
  min-width: 0;
  padding: var(--space-2) var(--space-1);
  border-radius: var(--radius-lg);
}
.a-person--link:hover {
  background: var(--hover);
}
.a-person__photo {
  border-radius: 50%;
  overflow: hidden;
  background: var(--surface2);
  flex: none;
  display: block;
}
.a-person__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  display: block;
}
.a-person__name {
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1.25;
}
.a-person__role {
  font-size: var(--text-xs);
  color: var(--muted);
  line-height: 1.25;
  margin-top: -3px;
}
.a-person__tag {
  margin-top: var(--space-0_5);
}
</style>
