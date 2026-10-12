<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    readonly?: boolean
    label?: string
    /** Clicking the current value clears the rating. */
    clearable?: boolean
  }>(),
  { size: 'md', readonly: false, label: 'Rating', clearable: true },
)
const model = defineModel<number | null>({ default: null })
const hover = ref<number | null>(null)

function pick(n: number, ev?: Event) {
  ev?.stopPropagation()
  if (props.readonly) return
  model.value = props.clearable && model.value === n ? null : n
}
</script>

<template>
  <div
    class="a-stars"
    :class="[`a-stars--${size}`, { 'a-stars--readonly': readonly }]"
    role="radiogroup"
    :aria-label="label"
    @mouseleave="hover = null"
  >
    <button
      v-for="n in 5"
      :key="n"
      type="button"
      role="radio"
      class="a-stars__star"
      :class="{ 'a-stars__star--on': n <= (hover ?? model ?? 0) }"
      :aria-checked="model === n"
      :aria-label="`${n} star${n === 1 ? '' : 's'}`"
      :tabindex="readonly ? -1 : 0"
      @mouseenter="!readonly && (hover = n)"
      @click="pick(n, $event)"
    >
      ★
    </button>
  </div>
</template>

<style scoped>
.a-stars {
  display: inline-flex;
  gap: 1px;
  margin-left: -2px;
}
.a-stars__star {
  border: 0;
  background: transparent;
  padding: var(--space-0_5);
  line-height: 1;
  color: var(--line2);
  transition:
    color var(--dur-fast),
    transform var(--dur-fast) var(--ease);
}
.a-stars--sm .a-stars__star {
  font-size: var(--text-xl);
}
.a-stars--md .a-stars__star {
  font-size: var(--text-2xl);
  padding: 3px;
}
.a-stars--lg .a-stars__star {
  font-size: var(--text-3xl);
  padding: 0 3px;
  line-height: 1.1;
}
.a-stars__star--on {
  color: var(--star);
}
.a-stars:not(.a-stars--readonly) .a-stars__star:hover {
  transform: scale(1.12);
}
.a-stars--readonly .a-stars__star {
  cursor: default;
}
</style>
