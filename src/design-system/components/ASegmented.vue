<script setup lang="ts" generic="T extends string | number">
export interface SegmentOption<T> {
  value: T
  label: string
}
defineProps<{ options: SegmentOption<T>[]; ariaLabel?: string }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="a-seg" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      role="tab"
      class="a-seg__opt"
      :class="{ 'a-seg__opt--on': o.value === model }"
      :aria-selected="o.value === model"
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
.a-seg {
  display: inline-flex;
  padding: 3px;
  background: var(--surface2);
  border-radius: var(--radius-md);
  gap: 2px;
  flex-wrap: wrap;
}
.a-seg__opt {
  border: 0;
  font-size: 13px;
  font-weight: 500;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted);
  transition:
    background var(--dur-fast),
    color var(--dur-fast);
}
.a-seg__opt--on {
  background: var(--surface);
  color: var(--fg);
  box-shadow: var(--shadow-seg);
}
</style>
