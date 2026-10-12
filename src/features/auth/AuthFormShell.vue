<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="page form-shell">
    <div class="form-shell__head">
      <h1 class="form-shell__title">{{ title }}</h1>
      <p v-if="subtitle" class="t-sub">{{ subtitle }}</p>
    </div>
    <slot />
    <div v-if="$slots.footer" class="form-shell__foot"><slot name="footer" /></div>
  </div>
</template>

<style scoped>
.form-shell__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}
.form-shell__title {
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: var(--tracking-tight);
  line-height: 1.05;
}
.form-shell__foot {
  font-size: var(--text-base);
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1_5) var(--space-3_5);
}
.form-shell > :deep(form) {
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
}
</style>
