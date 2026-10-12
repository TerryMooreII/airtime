<script setup lang="ts">
import { useId } from 'vue'

withDefaults(
  defineProps<{
    label?: string
    placeholder?: string
    rows?: number
    hint?: string
    /** Monospace: pasted data, code. */
    mono?: boolean
    spellcheck?: boolean
  }>(),
  { rows: 5, mono: false, spellcheck: true },
)
const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="a-textarea">
    <label v-if="label" :for="id" class="a-textarea__label">{{ label }}</label>
    <textarea
      :id="id"
      v-model="model"
      class="a-textarea__el"
      :class="{ 'a-textarea__el--mono': mono }"
      :rows="rows"
      :placeholder="placeholder"
      :spellcheck="spellcheck"
    />
    <p v-if="hint" class="a-textarea__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.a-textarea {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.a-textarea__label {
  font-size: 13px;
  font-weight: 600;
}
.a-textarea__el {
  width: 100%;
  resize: vertical;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--surface2);
  border: 1px solid transparent;
  color: var(--fg);
  font-size: 14px;
  line-height: 1.5;
  outline: 0;
  transition: border-color var(--dur-fast) var(--ease);
}
.a-textarea__el--mono {
  font: 500 13px/1.6 var(--font-mono);
}
.a-textarea__el:focus {
  border-color: var(--line2);
}
.a-textarea__el::placeholder {
  color: var(--muted);
}
.a-textarea__hint {
  font-size: 12.5px;
  color: var(--muted);
}
@media (max-width: 759px) {
  .a-textarea__el {
    font-size: 16px;
  }
}
</style>
