<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import AIcon from './AIcon.vue'
import type { IconName } from '../icons'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'soft'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    icon?: IconName
    loading?: boolean
    disabled?: boolean
    block?: boolean
    round?: boolean
    to?: RouteLocationRaw
    /** External link: renders an anchor that opens in a new tab. */
    href?: string
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
    block: false,
    round: false,
  },
)

const classes = computed(() => [
  'a-btn',
  `a-btn--${props.variant}`,
  `a-btn--${props.size}`,
  { 'a-btn--block': props.block, 'a-btn--round': props.round, 'a-btn--loading': props.loading },
])
const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <RouterLink v-if="to && !isDisabled" :to="to" :class="classes">
    <slot name="icon"><AIcon v-if="icon" :name="icon" :size="size === 'sm' ? 15 : 17" /></slot>
    <slot />
  </RouterLink>
  <a
    v-else-if="href && !isDisabled"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    :class="classes"
  >
    <slot name="icon"><AIcon v-if="icon" :name="icon" :size="size === 'sm' ? 15 : 17" /></slot>
    <slot />
  </a>
  <button
    v-else
    :type="type"
    :class="classes"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
  >
    <AIcon v-if="loading" name="spinner" :size="size === 'sm' ? 15 : 17" />
    <slot v-else name="icon"
      ><AIcon v-if="icon" :name="icon" :size="size === 'sm' ? 15 : 17"
    /></slot>
    <slot />
  </button>
</template>

<style scoped>
.a-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  transition:
    background var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease),
    color var(--dur-fast) var(--ease),
    opacity var(--dur-fast);
  user-select: none;
}
.a-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.a-btn--sm {
  height: 34px;
  padding: 0 14px;
  font-size: var(--text-sm);
}
.a-btn--md {
  height: 42px;
  padding: 0 18px;
  font-size: var(--text-base);
}
.a-btn--lg {
  height: 46px;
  padding: 0 22px;
  font-size: var(--text-base);
  border-radius: var(--radius-lg);
}
.a-btn--block {
  display: flex;
  width: 100%;
}
.a-btn--round {
  border-radius: var(--radius-pill);
  padding-inline: 0;
  aspect-ratio: 1;
}

.a-btn--primary {
  background: var(--primary);
  color: var(--on-primary);
  border-color: var(--primary);
}
.a-btn--primary:not(:disabled):hover {
  filter: brightness(1.08);
}
.a-btn--outline {
  background: transparent;
  color: var(--fg);
  border-color: var(--line2);
}
.a-btn--outline:not(:disabled):hover {
  background: var(--hover);
}
.a-btn--ghost {
  background: transparent;
  color: var(--muted);
}
.a-btn--ghost:not(:disabled):hover {
  color: var(--fg);
  background: var(--hover);
}
.a-btn--soft {
  background: var(--primary-soft);
  color: var(--primary-text);
}
.a-btn--soft:not(:disabled):hover {
  filter: brightness(1.1);
}
.a-btn--danger {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: transparent;
}
.a-btn--danger:not(:disabled):hover {
  background: var(--danger);
  color: var(--on-danger);
}
</style>
