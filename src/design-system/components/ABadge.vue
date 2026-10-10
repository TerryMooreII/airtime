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
  gap: 4px;
  flex: none;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  line-height: 1.2;
  white-space: nowrap;
}
.a-badge--mono {
  font: 600 10.5px var(--font-mono);
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
