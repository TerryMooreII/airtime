<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import APoster from './APoster.vue'

/**
 * A small poster beside a title and a line of meta: the row shape used by lists, tables and
 * search results. Renders a link, an external link, a button or a plain row depending on props.
 */
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    image: string | null | undefined
    /** Poster width in px. */
    imageWidth?: number
    ratio?: 'poster' | 'still'
    to?: RouteLocationRaw
    href?: string
    /** Render a button (emits `click`). */
    button?: boolean
    /** Highlight on hover (for clickable rows). */
    hover?: boolean
  }>(),
  { imageWidth: 40, ratio: 'poster', button: false, hover: false },
)
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <component
    :is="to ? RouterLink : href ? 'a' : button ? 'button' : 'div'"
    :to="to"
    :href="href"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener noreferrer' : undefined"
    :type="button ? 'button' : undefined"
    class="a-media"
    :class="{ 'a-media--hover': hover || button || !!to || !!href }"
    @click="button && emit('click')"
  >
    <APoster
      :src="image"
      :ratio="ratio"
      radius="sm"
      class="a-media__img"
      :style="{ width: `${imageWidth}px` }"
    />
    <span class="a-media__text">
      <span class="a-media__title truncate">{{ title }}</span>
      <span v-if="subtitle" class="a-media__sub truncate">{{ subtitle }}</span>
      <slot />
    </span>
    <slot name="trailing" />
  </component>
</template>

<style scoped>
.a-media {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  width: 100%;
  text-align: left;
  color: var(--fg);
  text-decoration: none;
  border: 0;
  background: transparent;
  padding: 0;
  border-radius: var(--radius-md);
}
.a-media--hover {
  padding: 6px;
  margin: 0 -6px;
  width: calc(100% + 12px);
  transition: background var(--dur-fast) var(--ease);
}
.a-media--hover:hover {
  background: var(--hover);
  color: var(--fg);
}
.a-media__img {
  flex: none;
}
.a-media__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.a-media__title {
  font-weight: 600;
  line-height: 1.25;
}
.a-media__sub {
  font: 500 12px var(--font-mono);
  color: var(--muted);
}
</style>
