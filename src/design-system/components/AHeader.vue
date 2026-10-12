<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; subtitle?: string; kicker?: string; level?: 'page' | 'section' }>(),
  { level: 'page' },
)
</script>

<template>
  <div class="a-header" :class="`a-header--${level}`">
    <div class="stack-tight a-header__text">
      <span v-if="kicker" class="t-label a-header__kicker">{{ kicker }}</span>
      <h1 v-if="level === 'page'" class="t-h1">{{ title }}</h1>
      <span v-else class="a-header__title">{{ title }}</span>
      <p v-if="subtitle" class="a-header__sub" :class="{ 't-sub': level === 'page' }">
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.default" class="cluster a-header__actions"><slot /></div>
  </div>
</template>

<style scoped>
.a-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
}
.a-header--page {
  gap: var(--space-4);
}
.a-header--page .a-header__text {
  gap: var(--space-1_5);
}
.a-header__kicker {
  color: var(--primary-text);
}
.a-header__title {
  font-size: var(--text-xl);
  font-weight: 650;
  letter-spacing: -0.02em;
}
.a-header--section .a-header__sub {
  font-size: var(--text-sm);
  color: var(--muted);
}
</style>
