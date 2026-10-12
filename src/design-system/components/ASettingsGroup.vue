<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section class="a-settings">
    <div class="a-settings__title t-label">{{ title }}</div>
    <slot />
  </section>
</template>

<style scoped>
.a-settings {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-xl);
  background: var(--surface);
  border: 1px solid var(--line);
}
.a-settings__title {
  padding: var(--space-3_5) var(--space-4_5) var(--space-1_5);
}
.a-settings > :deep(.a-settings-row:last-child) {
  border-bottom: 0;
}
</style>
