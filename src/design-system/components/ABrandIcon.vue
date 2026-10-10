<script setup lang="ts">
import { computed } from 'vue'

export type Brand = 'imdb' | 'thetvdb' | 'tvmaze'

const BRANDS: Record<Brand, { src: string; label: string; radius: string }> = {
  imdb: { src: '/brands/imdb.svg', label: 'IMDb', radius: '3px' },
  thetvdb: { src: '/brands/thetvdb.svg', label: 'TheTVDB', radius: '0' },
  tvmaze: { src: '/brands/tvmaze.png', label: 'TVmaze', radius: '4px' },
}

const props = withDefaults(defineProps<{ brand: Brand; size?: number }>(), { size: 16 })
const meta = computed(() => BRANDS[props.brand])
</script>

<template>
  <img
    class="a-brand"
    :src="meta.src"
    :alt="meta.label"
    :width="size"
    :height="size"
    :style="{ borderRadius: meta.radius }"
    loading="lazy"
    decoding="async"
  />
</template>

<style scoped>
.a-brand {
  flex: none;
  display: inline-block;
  object-fit: contain;
  vertical-align: middle;
}
</style>
