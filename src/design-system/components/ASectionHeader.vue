<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="a-section">
    <div class="a-section__text">
      <span class="a-section__title">{{ title }}</span>
      <span v-if="subtitle" class="a-section__sub">{{ subtitle }}</span>
    </div>
    <div v-if="$slots.default" class="a-section__actions"><slot /></div>
  </div>
</template>

<style scoped>
.a-section {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.a-section__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.a-section__title {
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.a-section__sub {
  font-size: 13.5px;
  color: var(--muted);
}
.a-section__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
