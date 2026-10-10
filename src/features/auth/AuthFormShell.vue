<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="form-shell">
    <div class="form-shell__head">
      <h1 class="form-shell__title">{{ title }}</h1>
      <p v-if="subtitle" class="t-sub">{{ subtitle }}</p>
    </div>
    <slot />
    <div v-if="$slots.footer" class="form-shell__foot"><slot name="footer" /></div>
  </div>
</template>

<style scoped>
.form-shell {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.form-shell__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-shell__title {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.05;
}
.form-shell__foot {
  font-size: 14px;
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}
:deep(form) {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
