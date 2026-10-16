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
  gap: var(--space-3);
  padding: var(--space-3_5) var(--space-4_5);
  border-bottom: 1px solid var(--line);
}
.a-settings-row--stacked {
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-2_5);
}
.a-settings-row__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  min-width: 0;
  flex: 1 1 200px;
  overflow-wrap: anywhere;
}
.a-settings-row__title {
  font-size: var(--text-md);
  font-weight: 600;
}
.a-settings-row__desc {
  font-size: var(--text-sm);
  color: var(--muted);
}
.a-settings-row__control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
}
/* In a column the 200px basis would apply to height and leave a gap under the text. */
.a-settings-row--stacked .a-settings-row__text {
  flex: none;
}
.a-settings-row--stacked .a-settings-row__control {
  align-self: stretch;
}
</style>
