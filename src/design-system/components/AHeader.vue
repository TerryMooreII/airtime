<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; subtitle?: string; kicker?: string; level?: 'page' | 'section' }>(),
  { level: 'page' },
)
</script>

<template>
  <div class="a-header" :class="`a-header--${level}`">
    <div class="a-header__text">
      <span v-if="kicker" class="t-label a-header__kicker">{{ kicker }}</span>
      <h1 v-if="level === 'page'" class="t-h1">{{ title }}</h1>
      <span v-else class="a-header__title">{{ title }}</span>
      <p v-if="subtitle" class="a-header__sub" :class="{ 't-sub': level === 'page' }">
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.default" class="a-header__actions"><slot /></div>
  </div>
</template>

<style scoped>
.a-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.a-header--page {
  gap: 16px;
}
.a-header__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.a-header--page .a-header__text {
  gap: 6px;
}
.a-header__kicker {
  color: var(--primary-text);
}
.a-header__title {
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.a-header--section .a-header__sub {
  font-size: 13.5px;
  color: var(--muted);
}
.a-header__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
