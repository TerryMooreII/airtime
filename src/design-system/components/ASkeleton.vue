<script setup lang="ts">
withDefaults(defineProps<{ height?: string; width?: string; radius?: string; ratio?: string }>(), {
  height: '64px',
  width: '100%',
  radius: 'var(--radius-lg)',
})
</script>

<template>
  <div class="a-skeleton" :style="{ height: ratio ? undefined : height, width, borderRadius: radius, aspectRatio: ratio }" aria-hidden="true" />
</template>

<style scoped>
.a-skeleton {
  background: var(--surface2);
  animation: ad-pulse 1.4s ease-in-out infinite;
}
</style>
