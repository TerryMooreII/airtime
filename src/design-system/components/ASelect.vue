<script setup lang="ts">
import { useId } from 'vue'

export interface SelectOption {
  value: string | number
  label: string
}

withDefaults(
  defineProps<{ label?: string; options: SelectOption[]; disabled?: boolean; hint?: string }>(),
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
      <select :id="id" v-model="model" class="a-select__el" :disabled="disabled">
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <svg
        class="a-select__chev"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
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
</style>
