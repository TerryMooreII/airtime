<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'soft' | 'outline' | 'muted' | 'success' | 'danger' | 'warning'
    mono?: boolean
  }>(),
  { variant: 'soft', mono: true },
)
</script>

<template>
  <span class="a-badge" :class="[`a-badge--${variant}`, { 'a-badge--mono': mono }]"><slot /></span>
</template>

<style scoped>
.a-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex: none;
  font-size: var(--text-xs);
  font-weight: 600;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-badge);
  line-height: 1.2;
  white-space: nowrap;
}
.a-badge--mono {
  font: 600 var(--text-2xs) var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 7px;
}
.a-badge--primary {
  background: var(--primary);
  color: var(--on-primary);
}
.a-badge--soft {
  background: var(--primary-soft);
  color: var(--primary-text);
}
.a-badge--outline {
  border: 1px solid var(--line2);
  color: var(--fg);
}
.a-badge--muted {
  background: var(--surface2);
  color: var(--muted);
}
.a-badge--success {
  background: var(--success-soft);
  color: var(--success);
}
.a-badge--danger {
  background: var(--danger-soft);
  color: var(--danger);
}
.a-badge--warning {
  background: var(--warning-soft);
  color: var(--warning);
}
</style>
