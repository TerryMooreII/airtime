<script setup lang="ts">
import { toRef } from 'vue'

import { useOverlay } from '@/composables/useOverlay'

import AIcon from './AIcon.vue'

/** Side panel on desktop, bottom sheet on mobile (mirrors the mock's episode drawer). */
const props = withDefaults(defineProps<{ open: boolean; title?: string; width?: string }>(), {
  width: '460px',
})
const emit = defineEmits<{ close: [] }>()
useOverlay(toRef(props, 'open'), () => emit('close'), { lockScroll: true })
</script>

<template>
  <Teleport to="body">
    <Transition name="a-drawer">
      <div v-if="open" class="a-drawer" role="dialog" aria-modal="true" :aria-label="title">
        <div class="a-drawer__scrim" @click="emit('close')" />
        <div class="a-drawer__panel" :style="{ '--drawer-w': width }">
          <button type="button" class="a-drawer__close" aria-label="Close" @click="emit('close')">
            <AIcon name="close" :size="18" :stroke-width="2.2" />
          </button>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.a-drawer {
  position: fixed;
  inset: 0;
  z-index: var(--z-drawer);
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
}
.a-drawer__scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
}
.a-drawer__panel {
  position: relative;
  width: var(--drawer-w, 460px);
  height: 100%;
  background: var(--surface);
  overflow: auto;
  box-shadow: var(--shadow-drawer);
  display: flex;
  flex-direction: column;
}
.a-drawer__close {
  position: absolute;
  right: 12px;
  top: 12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 0;
  background: var(--image-scrim);
  color: var(--on-image);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}
.a-drawer-enter-active,
.a-drawer-leave-active {
  transition: opacity var(--dur) var(--ease);
}
.a-drawer-enter-active .a-drawer__panel,
.a-drawer-leave-active .a-drawer__panel {
  transition: transform var(--dur) var(--ease);
}
.a-drawer-enter-from,
.a-drawer-leave-to {
  opacity: 0;
}
.a-drawer-enter-from .a-drawer__panel,
.a-drawer-leave-to .a-drawer__panel {
  transform: translateX(24px);
}
@media (max-width: 759px) {
  .a-drawer__panel {
    width: 100%;
    height: 90%;
    border-radius: 22px 22px 0 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .a-drawer-enter-from .a-drawer__panel,
  .a-drawer-leave-to .a-drawer__panel {
    transform: translateY(24px);
  }
}
</style>
