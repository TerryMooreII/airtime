<script setup lang="ts">
import AIcon from './AIcon.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="a-toaster" aria-live="polite">
    <TransitionGroup name="a-toast">
      <div v-for="t in ui.toasts" :key="t.id" class="a-toast" :class="`a-toast--${t.variant}`" role="status">
        <AIcon :name="t.variant === 'success' ? 'check' : t.variant === 'error' ? 'warning' : 'info'" :size="16" />
        <span class="a-toast__msg">{{ t.message }}</span>
        <button type="button" class="a-toast__close" aria-label="Dismiss" @click="ui.dismiss(t.id)"><AIcon name="close" :size="14" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.a-toaster {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(420px, calc(100vw - 32px));
  pointer-events: none;
}
.a-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--line2);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  font-size: 14px;
}
.a-toast--success {
  color: var(--success);
}
.a-toast--error {
  color: var(--danger);
}
.a-toast__msg {
  flex: 1;
  color: var(--fg);
}
.a-toast__close {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 4px;
  display: flex;
  border-radius: var(--radius-xs);
}
.a-toast-enter-active,
.a-toast-leave-active {
  transition:
    opacity var(--dur) var(--ease),
    transform var(--dur) var(--ease);
}
.a-toast-enter-from,
.a-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (max-width: 759px) {
  .a-toaster {
    bottom: 90px;
  }
}
</style>
