<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="a-page-head">
    <div class="a-page-head__text">
      <h1 class="t-h1">{{ title }}</h1>
      <p v-if="subtitle" class="t-sub">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.default" class="a-page-head__actions"><slot /></div>
  </div>
</template>

<style scoped>
.a-page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.a-page-head__text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.a-page-head__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
