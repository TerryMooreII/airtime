<script setup lang="ts">
import { computed } from 'vue'

import { initials } from '@/lib/format'

const props = withDefaults(defineProps<{ name?: string | null; src?: string | null; size?: number }>(), { size: 32 })
const text = computed(() => initials(props.name))
</script>

<template>
  <span class="a-avatar" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` }">
    <img v-if="src" :src="src" :alt="name ?? ''" class="a-avatar__img" />
    <span v-else>{{ text }}</span>
  </span>
</template>

<style scoped>
.a-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary-text);
  font-weight: 700;
  overflow: hidden;
  flex: none;
  letter-spacing: 0.02em;
}
.a-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
