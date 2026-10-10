<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; dashed?: boolean; compact?: boolean }>(), {
  dashed: true,
  compact: false,
})
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
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.a-empty--dashed {
  border: 1px dashed var(--line2);
}
.a-empty--compact {
  padding: 24px 16px;
}
.a-empty__title {
  font-size: 18px;
  font-weight: 600;
}
.a-empty--compact .a-empty__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--muted);
}
.a-empty__desc {
  color: var(--muted);
  font-size: 14px;
  max-width: 340px;
  text-wrap: pretty;
}
.a-empty__actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
</style>
