<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; stacked?: boolean }>(), {
  stacked: false,
})
</script>

<template>
  <div class="a-settings-row" :class="{ 'a-settings-row--stacked': stacked }">
    <div class="a-settings-row__text">
      <span class="a-settings-row__title">{{ title }}</span>
      <span v-if="description" class="a-settings-row__desc">{{ description }}</span>
    </div>
    <div class="a-settings-row__control"><slot /></div>
  </div>
</template>

<style scoped>
.a-settings-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}
.a-settings-row--stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}
.a-settings-row__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.a-settings-row__title {
  font-size: 15px;
  font-weight: 600;
}
.a-settings-row__desc {
  font-size: 13px;
  color: var(--muted);
}
.a-settings-row__control {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.a-settings-row--stacked .a-settings-row__control {
  align-self: flex-start;
}
</style>
