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
  gap: var(--space-3);
  padding: var(--space-3_5) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--line2);
  font-size: var(--text-base);
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
  border-color: var(--warning);
  background: var(--warning-soft);
}
.a-alert--warning .a-alert__icon {
  color: var(--warning);
}
.a-alert--info {
  background: var(--primary-soft);
}
.a-alert--info .a-alert__icon {
  color: var(--primary-text);
}
.a-alert__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  min-width: 0;
}
.a-alert__title {
  font-weight: 600;
}
.a-alert__retry {
  border: 0;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3_5);
  background: var(--primary);
  color: var(--on-primary);
  font-weight: 600;
}
</style>
