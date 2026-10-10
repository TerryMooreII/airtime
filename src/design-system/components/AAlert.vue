<script setup lang="ts">
import AIcon from './AIcon.vue'

withDefaults(
  defineProps<{ variant?: 'error' | 'info' | 'success' | 'warning'; title?: string }>(),
  { variant: 'info' },
)
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="a-alert" :class="`a-alert--${variant}`" role="alert">
    <AIcon
      :name="variant === 'error' ? 'warning' : variant === 'success' ? 'check' : 'info'"
      :size="17"
      class="a-alert__icon"
    />
    <div class="a-alert__body">
      <strong v-if="title" class="a-alert__title">{{ title }}</strong>
      <span class="a-alert__text"><slot /></span>
    </div>
    <button v-if="$attrs.onRetry" type="button" class="a-alert__retry" @click="emit('retry')">
      Retry
    </button>
  </div>
</template>

<style scoped>
.a-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--line2);
  font-size: 14px;
}
.a-alert__icon {
  flex: none;
}
.a-alert--error {
  border-color: var(--danger);
  background: var(--danger-soft);
}
.a-alert--error .a-alert__icon {
  color: var(--danger);
}
.a-alert--success {
  border-color: var(--success);
  background: var(--success-soft);
}
.a-alert--success .a-alert__icon {
  color: var(--success);
}
.a-alert--warning {
  background: var(--warning-soft);
}
.a-alert--warning .a-alert__icon {
  color: var(--warning);
}
.a-alert__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.a-alert__title {
  font-weight: 600;
}
.a-alert__retry {
  border: 0;
  border-radius: var(--radius-sm);
  padding: 8px 14px;
  background: var(--primary);
  color: var(--on-primary);
  font-weight: 600;
}
</style>
