<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; description?: string; dashed?: boolean; compact?: boolean }>(),
  {
    dashed: true,
    compact: false,
  },
)
</script>

<template>
  <div class="a-empty" :class="{ 'a-empty--dashed': dashed, 'a-empty--compact': compact }">
    <span class="a-empty__title">{{ title }}</span>
    <span v-if="description" class="a-empty__desc">{{ description }}</span>
    <div v-if="$slots.default" class="a-empty__actions"><slot /></div>
  </div>
</template>

<style scoped>
.a-empty {
  border-radius: var(--radius-xl);
  padding: var(--space-10) var(--space-5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2_5);
  text-align: center;
}
.a-empty--dashed {
  border: 1px dashed var(--line2);
}
.a-empty--compact {
  padding: var(--space-6) var(--space-4);
}
.a-empty__title {
  font-size: var(--text-lg);
  font-weight: 600;
}
.a-empty--compact .a-empty__title {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--muted);
}
.a-empty__desc {
  color: var(--muted);
  font-size: var(--text-base);
  max-width: 340px;
  text-wrap: pretty;
}
.a-empty__actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1_5);
}
</style>
