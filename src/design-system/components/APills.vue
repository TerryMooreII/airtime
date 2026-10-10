<script setup lang="ts" generic="T extends string | number">
export interface PillOption<T> {
  value: T
  label: string
  count?: number
}
withDefaults(defineProps<{ options: PillOption<T>[]; mono?: boolean; ariaLabel?: string }>(), {
  mono: false,
})
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="a-pills" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      role="tab"
      class="a-pill"
      :class="{ 'a-pill--on': o.value === model, 'a-pill--mono': mono }"
      :aria-selected="o.value === model"
      @click="model = o.value"
    >
      {{ o.label }}<span v-if="o.count !== undefined" class="a-pill__count">{{ o.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.a-pills {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.a-pill {
  flex: none;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line2);
  background: transparent;
  color: var(--fg);
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition:
    background var(--dur-fast),
    color var(--dur-fast);
}
.a-pill--mono {
  font: 600 12.5px var(--font-mono);
}
.a-pill:hover {
  background: var(--hover);
}
.a-pill--on {
  background: var(--fg);
  color: var(--bg);
  border-color: var(--fg);
}
.a-pill__count {
  font: 500 11.5px var(--font-mono);
  opacity: 0.7;
}
</style>
