<script setup lang="ts">
import { ref } from 'vue'

import AIcon from './AIcon.vue'

withDefaults(
  defineProps<{
    src: string | null | undefined
    alt?: string
    /** Aspect ratio: poster 2/3 or still 16/9. */
    ratio?: 'poster' | 'still'
    radius?: 'sm' | 'md' | 'lg'
  }>(),
  { alt: '', ratio: 'poster', radius: 'md' },
)
const failed = ref(false)
</script>

<template>
  <div class="a-poster" :class="[`a-poster--${ratio}`, `a-poster--r-${radius}`]">
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      loading="lazy"
      decoding="async"
      class="a-poster__img"
      @error="failed = true"
    />
    <div v-else class="a-poster__empty" aria-hidden="true">
      <AIcon name="tv" :size="28" :stroke-width="1.6" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.a-poster {
  position: relative;
  overflow: hidden;
  background: var(--surface2);
  width: 100%;
}
.a-poster--poster {
  aspect-ratio: 2 / 3;
}
.a-poster--still {
  aspect-ratio: 16 / 9;
}
.a-poster--r-sm {
  border-radius: var(--radius-xs);
}
.a-poster--r-md {
  border-radius: var(--radius-sm);
}
.a-poster--r-lg {
  border-radius: var(--radius-lg);
}
.a-poster__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.a-poster__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--line2);
}
</style>
