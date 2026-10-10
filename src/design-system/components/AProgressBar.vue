<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ value: number; max?: number; size?: 'sm' | 'md'; label?: string }>(),
  {
    max: 100,
    size: 'sm',
  },
)
const pct = computed(() =>
  props.max > 0 ? Math.max(0, Math.min(100, (props.value / props.max) * 100)) : 0,
)
</script>

<template>
  <div
    class="a-progress"
    :class="`a-progress--${size}`"
    role="progressbar"
    :aria-valuenow="Math.round(pct)"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label"
  >
    <div class="a-progress__fill" :style="{ width: `${pct}%` }" />
  </div>
</template>

<style scoped>
.a-progress {
  width: 100%;
  border-radius: 3px;
  background: var(--surface2);
  overflow: hidden;
}
.a-progress--sm {
  height: 4px;
}
.a-progress--md {
  height: 6px;
}
.a-progress__fill {
  height: 100%;
  background: var(--primary);
  border-radius: 3px;
  transition: width var(--dur) var(--ease);
}
</style>
