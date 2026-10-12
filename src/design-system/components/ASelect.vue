<script setup lang="ts">
import { useId } from 'vue'

import AIcon from './AIcon.vue'

export interface SelectOption {
  value: string | number
  label: string
}

withDefaults(
  defineProps<{
    label?: string
    options: SelectOption[]
    disabled?: boolean
    hint?: string
    /** For selects without a visible label (table cells). */
    ariaLabel?: string
  }>(),
  {
    disabled: false,
  },
)
const model = defineModel<string | number>({ required: true })
const id = useId()
</script>

<template>
  <div class="a-select">
    <label v-if="label" :for="id" class="a-select__label">{{ label }}</label>
    <div class="a-select__box">
      <select
        :id="id"
        v-model="model"
        class="a-select__el"
        :disabled="disabled"
        :aria-label="ariaLabel"
      >
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <AIcon name="chevronDown" :size="14" :stroke-width="2.2" class="a-select__chev" />
    </div>
    <p v-if="hint" class="a-select__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.a-select {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.a-select__label {
  font-size: 13px;
  font-weight: 600;
}
.a-select__box {
  position: relative;
  display: flex;
  align-items: center;
  height: 42px;
  border-radius: var(--radius-md);
  background: var(--surface2);
  border: 1px solid transparent;
}
.a-select__box:focus-within {
  border-color: var(--line2);
}
.a-select__el {
  appearance: none;
  text-overflow: ellipsis;
  flex: 1;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  padding: 0 34px 0 12px;
  font-size: 14px;
  min-width: 0;
}
.a-select__chev {
  position: absolute;
  right: 12px;
  color: var(--muted);
  pointer-events: none;
}
.a-select__hint {
  font-size: 12.5px;
  color: var(--muted);
}

@media (max-width: 759px) {
  .a-select__el {
    font-size: 16px;
  }
}
</style>
