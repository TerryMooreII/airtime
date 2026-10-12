<script setup lang="ts">
import { toRef } from 'vue'

import { useOverlay } from '@/composables/useOverlay'

import AButton from './AButton.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    loading?: boolean
  }>(),
  { confirmLabel: 'Confirm', cancelLabel: 'Cancel', danger: false, loading: false },
)
const emit = defineEmits<{ close: []; confirm: [] }>()
useOverlay(toRef(props, 'open'), () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition name="a-modal">
      <div v-if="open" class="a-modal" role="dialog" aria-modal="true" :aria-label="title">
        <div class="a-modal__scrim" @click="emit('close')" />
        <div class="a-modal__card">
          <h2 class="a-modal__title">{{ title }}</h2>
          <p v-if="description" class="a-modal__desc">{{ description }}</p>
          <slot />
          <div class="a-modal__actions">
            <AButton variant="outline" @click="emit('close')">{{ cancelLabel }}</AButton>
            <AButton
              :variant="danger ? 'danger' : 'primary'"
              :loading="loading"
              @click="emit('confirm')"
              >{{ confirmLabel }}</AButton
            >
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.a-modal {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}
.a-modal__scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
}
.a-modal__card {
  position: relative;
  width: min(440px, 100%);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-drawer);
}
.a-modal__title {
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.a-modal__desc {
  color: var(--muted);
  font-size: var(--text-base);
  line-height: 1.5;
}
.a-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.a-modal-enter-active,
.a-modal-leave-active {
  transition: opacity var(--dur) var(--ease);
}
.a-modal-enter-from,
.a-modal-leave-to {
  opacity: 0;
}
</style>
