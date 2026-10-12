<script setup lang="ts" generic="T extends string | number">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

export interface ChoiceOption<T> {
  value: T
  label: string
  count?: number
  /** Render as a router link (active state comes from the route) instead of a model choice. */
  to?: RouteLocationRaw
}

/**
 * One exclusive choice rendered three ways: a segmented control, a row of pills, or tabs.
 * Arrow keys move between options in every variant.
 */
const props = withDefaults(
  defineProps<{
    options: ChoiceOption<T>[]
    variant?: 'segmented' | 'pills' | 'tabs'
    /** Pills only: monospace labels (season numbers, codes). */
    mono?: boolean
    ariaLabel?: string
  }>(),
  { variant: 'segmented', mono: false },
)
const model = defineModel<T>()

function onKey(e: KeyboardEvent) {
  const i = props.options.findIndex((o) => o.value === model.value)
  if (i === -1) return
  const n = props.options.length
  if (e.key === 'ArrowRight') model.value = props.options[(i + 1) % n]!.value
  else if (e.key === 'ArrowLeft') model.value = props.options[(i - 1 + n) % n]!.value
  else return
  e.preventDefault()
}
</script>

<template>
  <div
    class="a-choice"
    :class="[`a-choice--${variant}`, { 'a-choice--mono': mono }]"
    role="tablist"
    :aria-label="ariaLabel"
    @keydown="onKey"
  >
    <template v-for="o in options" :key="String(o.value)">
      <RouterLink
        v-if="o.to"
        :to="o.to"
        class="a-choice__opt"
        active-class="a-choice__opt--on"
        exact-active-class="a-choice__opt--on"
        role="tab"
      >
        {{ o.label }}<span v-if="o.count !== undefined" class="a-choice__count">{{ o.count }}</span>
      </RouterLink>
      <button
        v-else
        type="button"
        role="tab"
        class="a-choice__opt"
        :class="{ 'a-choice__opt--on': o.value === model }"
        :aria-selected="o.value === model"
        :tabindex="o.value === model || model === undefined ? 0 : -1"
        @click="model = o.value"
      >
        {{ o.label }}<span v-if="o.count !== undefined" class="a-choice__count">{{ o.count }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.a-choice__opt {
  border: 0;
  background: transparent;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1_5);
  white-space: nowrap;
  text-decoration: none;
  transition:
    background var(--dur-fast) var(--ease),
    color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}
.a-choice__count {
  font: 500 var(--text-2xs) var(--font-mono);
}

/* Segmented: a pill-shaped track with the active option raised. */
.a-choice--segmented {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-0_5);
  padding: 3px;
  background: var(--surface2);
  border-radius: var(--radius-md);
}
.a-choice--segmented .a-choice__opt {
  font-size: var(--text-sm);
  font-weight: 500;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
}
.a-choice--segmented .a-choice__opt--on {
  background: var(--surface);
  color: var(--fg);
  box-shadow: var(--shadow-seg);
}

/* Pills: outlined chips in a horizontally scrolling row. */
.a-choice--pills {
  display: flex;
  gap: var(--space-1_5);
  overflow-x: auto;
  padding-bottom: var(--space-0_5);
  scrollbar-width: none;
}
.a-choice--pills .a-choice__opt {
  flex: none;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line2);
  color: var(--fg);
  font-size: var(--text-sm);
  font-weight: 500;
}
.a-choice--pills.a-choice--mono .a-choice__opt {
  font: 600 var(--text-xs) var(--font-mono);
}
.a-choice--pills .a-choice__opt:not(.a-choice__opt--on):hover {
  background: var(--hover);
  border-color: var(--fg);
}
.a-choice--pills .a-choice__opt--on {
  background: var(--fg);
  color: var(--bg);
  border-color: var(--fg);
}
.a-choice--pills .a-choice__opt--on:hover {
  opacity: 0.88;
}
.a-choice--pills .a-choice__count {
  opacity: 0.7;
}

/* Tabs: text with an accent underline. */
.a-choice--tabs {
  display: flex;
  gap: 22px;
  border-bottom: 1px solid var(--line);
}
.a-choice--tabs .a-choice__opt {
  position: relative;
  font-size: var(--text-md);
  font-weight: 600;
  padding: var(--space-2_5) var(--space-0_5) var(--space-3);
  align-items: baseline;
  gap: var(--space-2);
}
.a-choice--tabs .a-choice__opt:hover,
.a-choice--tabs .a-choice__opt--on {
  color: var(--fg);
}
.a-choice--tabs .a-choice__opt--on::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--primary);
  border-radius: 2px 2px 0 0;
}
.a-choice--tabs .a-choice__count {
  color: var(--muted);
  background: var(--surface2);
  padding: 2px 7px;
  border-radius: var(--radius-pill);
}
</style>
