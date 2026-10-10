<script setup lang="ts">
import { computed } from 'vue'

export type Brand = 'imdb' | 'thetvdb' | 'tvmaze'

/** Each mark keeps its native proportions; `ratio` is width / height. */
const BRANDS: Record<Brand, { src: string; label: string; ratio: number; backed: boolean }> = {
  imdb: { src: '/brands/imdb.svg', label: 'IMDb', ratio: 1, backed: false },
  thetvdb: { src: '/brands/thetvdb.svg', label: 'TheTVDB', ratio: 100 / 54, backed: false },
  tvmaze: { src: '/brands/tvmaze.png', label: 'TVmaze', ratio: 1, backed: true },
}

const props = withDefaults(defineProps<{ brand: Brand; size?: number }>(), { size: 16 })
const meta = computed(() => BRANDS[props.brand])
const height = computed(() => props.size)
const width = computed(() => Math.round(props.size * meta.value.ratio))
</script>

<template>
  <span
    class="a-brand"
    :class="{ 'a-brand--backed': meta.backed }"
    :style="{ height: `${height}px`, width: `${width}px` }"
  >
    <img :src="meta.src" :alt="meta.label" class="a-brand__img" loading="lazy" decoding="async" />
  </span>
</template>

<style scoped>
.a-brand {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  border-radius: 4px;
  overflow: hidden;
}
/* Dark marks on a dark theme need a light backing to read. */
.a-brand--backed {
  background: #fff;
  padding: 1px;
}
.a-brand__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>
