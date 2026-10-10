<script setup lang="ts">
import { ref } from 'vue'

import AIcon from './AIcon.vue'

withDefaults(defineProps<{ accept?: string; label?: string; hint?: string }>(), {
  accept: '.csv,text/csv,text/plain',
  label: 'Drop a file here or click to choose',
  hint: '',
})
const emit = defineEmits<{ file: [file: File] }>()
const input = ref<HTMLInputElement | null>(null)
const over = ref(false)

function pick(files: FileList | null | undefined) {
  const f = files?.[0]
  if (f) emit('file', f)
}
function onChange(e: Event) {
  const el = e.target as HTMLInputElement
  pick(el.files)
  el.value = ''
}
function onDrop(e: DragEvent) {
  over.value = false
  pick(e.dataTransfer?.files)
}
</script>

<template>
  <div
    class="a-drop"
    :class="{ 'a-drop--over': over }"
    role="button"
    tabindex="0"
    @click="input?.click()"
    @keydown.enter.prevent="input?.click()"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="onDrop"
  >
    <input ref="input" type="file" :accept="accept" class="a-drop__input" @change="onChange" />
    <AIcon name="calendar" :size="22" class="a-drop__icon" />
    <span class="a-drop__label">{{ label }}</span>
    <span v-if="hint" class="a-drop__hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.a-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 20px;
  border: 1px dashed var(--line2);
  border-radius: var(--radius-xl);
  background: var(--surface);
  cursor: pointer;
  text-align: center;
  transition:
    border-color var(--dur-fast),
    background var(--dur-fast);
}
.a-drop:hover,
.a-drop--over {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.a-drop__input {
  display: none;
}
.a-drop__icon {
  color: var(--primary-text);
}
.a-drop__label {
  font-size: 15px;
  font-weight: 600;
}
.a-drop__hint {
  font-size: 13px;
  color: var(--muted);
}
</style>
