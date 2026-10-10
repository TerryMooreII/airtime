<script setup lang="ts">
defineProps<{ label: string; value: string | number; hint?: string }>()
</script>

<template>
  <div class="a-stat">
    <span class="t-label">{{ label }}</span>
    <span class="a-stat__value">{{ value }}</span>
    <span v-if="hint" class="a-stat__hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.a-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-radius: var(--radius-xl);
  background: var(--surface);
  border: 1px solid var(--line);
  min-width: 0;
}
.a-stat__value {
  font: 600 30px var(--font-mono);
  letter-spacing: -0.03em;
  line-height: 1;
}
.a-stat__hint {
  font-size: 12.5px;
  color: var(--muted);
}
</style>
