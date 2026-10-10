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
  padding: 14px 18px 6px;
}
.a-settings > :deep(.a-settings-row:last-child) {
  border-bottom: 0;
}
</style>
