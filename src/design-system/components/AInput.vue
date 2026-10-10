<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import AIcon from './AIcon.vue'
import type { IconName } from '../icons'

const props = withDefaults(
  defineProps<{
    label?: string
    type?: 'text' | 'email' | 'password' | 'search' | 'number' | 'url'
    placeholder?: string
    hint?: string
    error?: string | null
    icon?: IconName
    autocomplete?: string
    required?: boolean
    disabled?: boolean
    size?: 'md' | 'lg'
    min?: number
    max?: number
  }>(),
  { type: 'text', size: 'md', required: false, disabled: false },
)

const model = defineModel<string | number>({ default: '' })
const id = useId()
const reveal = ref(false)
const inputType = computed(() => (props.type === 'password' && reveal.value ? 'text' : props.type))
</script>

<template>
  <div class="a-field" :class="{ 'a-field--error': !!error, 'a-field--lg': size === 'lg' }">
    <label v-if="label" :for="id" class="a-field__label">{{ label }}</label>
    <div class="a-field__box">
      <AIcon v-if="icon" :name="icon" :size="16" class="a-field__icon" />
      <input
        :id="id"
        v-model="model"
        class="a-field__input"
        :type="inputType"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :required="required"
        :disabled="disabled"
        :min="min"
        :max="max"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error || hint ? `${id}-desc` : undefined"
      />
      <button
        v-if="type === 'password'"
        type="button"
        class="a-field__reveal"
        :aria-label="reveal ? 'Hide password' : 'Show password'"
        @click="reveal = !reveal"
      >
        <AIcon :name="reveal ? 'eyeOff' : 'eye'" :size="16" />
      </button>
    </div>
    <p v-if="error" :id="`${id}-desc`" class="a-field__msg a-field__msg--error">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-desc`" class="a-field__msg">{{ hint }}</p>
  </div>
</template>

<style scoped>
.a-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.a-field__label {
  font-size: 13px;
  font-weight: 600;
}
.a-field__box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  background: var(--surface2);
  border: 1px solid transparent;
  color: var(--muted);
  transition: border-color var(--dur-fast) var(--ease);
}
.a-field--lg .a-field__box {
  height: 48px;
  border-radius: var(--radius-lg);
  padding: 0 14px;
}
.a-field__box:focus-within {
  border-color: var(--line2);
}
.a-field--error .a-field__box {
  border-color: var(--danger);
}
.a-field__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font-size: 14px;
}
.a-field--lg .a-field__input {
  font-size: 16px;
}
.a-field__input::placeholder {
  color: var(--muted);
}
.a-field__input:disabled {
  opacity: 0.6;
}
.a-field__reveal {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 4px;
  display: flex;
  border-radius: var(--radius-xs);
}
.a-field__reveal:hover {
  color: var(--fg);
}
.a-field__msg {
  font-size: 12.5px;
  color: var(--muted);
}
.a-field__msg--error {
  color: var(--danger);
}
</style>
