<script setup lang="ts">
import { ICON_PATHS, type IconName } from '../icons'

withDefaults(
  defineProps<{
    name: IconName
    size?: number | string
    strokeWidth?: number
  }>(),
  { size: 18, strokeWidth: 1.8 },
)
</script>

<template>
  <svg
    class="a-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    :class="{ 'a-icon--spin': name === 'spinner' }"
  >
    <path :d="ICON_PATHS[name]" />
  </svg>
</template>

<style scoped>
.a-icon {
  flex: none;
  display: inline-block;
  vertical-align: middle;
}
.a-icon--spin {
  animation: a-spin 0.8s linear infinite;
}
@keyframes a-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
