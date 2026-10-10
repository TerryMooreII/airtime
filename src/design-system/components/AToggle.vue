<script setup lang="ts">
withDefaults(defineProps<{ label?: string; disabled?: boolean }>(), { disabled: false })
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <button
    type="button"
    role="switch"
    class="a-toggle"
    :class="{ 'a-toggle--on': model }"
    :aria-checked="model"
    :aria-label="label"
    :disabled="disabled"
    @click="model = !model"
  >
    <span class="a-toggle__knob" />
  </button>
</template>

<style scoped>
.a-toggle {
  flex: none;
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 13px;
  border: 0;
  padding: 0;
  background: var(--line2);
  transition: background var(--dur-fast) var(--ease);
}
.a-toggle--on {
  background: var(--primary);
}
.a-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.a-toggle__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform var(--dur-fast) var(--ease);
}
.a-toggle--on .a-toggle__knob {
  transform: translateX(18px);
}
</style>
