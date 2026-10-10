<script setup lang="ts" generic="T extends string | number">
export interface TabOption<T> {
  value: T
  label: string
  count?: number
}
defineProps<{ options: TabOption<T>[]; ariaLabel?: string }>()
const model = defineModel<T>({ required: true })

function onKey(e: KeyboardEvent, options: TabOption<T>[]) {
  const i = options.findIndex((o) => o.value === model.value)
  if (e.key === 'ArrowRight') model.value = options[(i + 1) % options.length]!.value
  else if (e.key === 'ArrowLeft')
    model.value = options[(i - 1 + options.length) % options.length]!.value
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="a-tabs" role="tablist" :aria-label="ariaLabel" @keydown="onKey($event, options)">
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      role="tab"
      class="a-tab"
      :class="{ 'a-tab--on': o.value === model }"
      :aria-selected="o.value === model"
      :tabindex="o.value === model ? 0 : -1"
      @click="model = o.value"
    >
      {{ o.label }}<span v-if="o.count !== undefined" class="a-tab__count">{{ o.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.a-tabs {
  display: flex;
  gap: 22px;
  border-bottom: 1px solid var(--line);
}
.a-tab {
  position: relative;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 15px;
  font-weight: 600;
  padding: 10px 2px 12px;
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  transition: color var(--dur-fast);
}
.a-tab:hover {
  color: var(--fg);
}
.a-tab--on {
  color: var(--fg);
}
.a-tab--on::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--primary);
  border-radius: 2px 2px 0 0;
}
.a-tab__count {
  font: 500 11.5px var(--font-mono);
  color: var(--muted);
  background: var(--surface2);
  padding: 2px 7px;
  border-radius: 999px;
}
.a-tab:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
</style>
