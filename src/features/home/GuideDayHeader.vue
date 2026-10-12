<script setup lang="ts">
import { plural } from '@/lib/format'

/** Sticky day heading above a list of episodes. */
defineProps<{ label: string; sub: string; count: number }>()
</script>

<template>
  <div class="head">
    <span class="head__label">{{ label }}</span>
    <span class="t-meta">{{ sub }}</span>
    <span class="t-meta head__count">{{ plural(count, 'ep') }}</span>
  </div>
</template>

<style scoped>
.head {
  position: sticky;
  top: var(--header-h);
  z-index: var(--z-sticky);
  background: var(--bg);
  display: flex;
  align-items: baseline;
  gap: var(--space-2_5);
  padding: 12px 0 10px;
  border-bottom: 1px solid var(--line);
  margin-bottom: var(--space-1_5);
}
.head__label {
  font-size: var(--text-xl);
  font-weight: 650;
  letter-spacing: -0.02em;
}
.head__count {
  margin-left: auto;
  font-size: var(--text-xs);
}
</style>
