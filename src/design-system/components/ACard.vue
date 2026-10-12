<script setup lang="ts">
withDefaults(defineProps<{ padding?: 'md' | 'lg'; radius?: 'xl' | '2xl' }>(), {
  padding: 'md',
  radius: 'xl',
})
</script>

<template>
  <div class="a-card" :class="[`a-card--p-${padding}`, `a-card--r-${radius}`]">
    <slot />
  </div>
</template>

<style scoped>
.a-card {
  background: var(--surface);
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.a-card--p-md {
  padding: var(--space-4);
}
.a-card--p-lg {
  padding: var(--space-4_5) var(--space-5);
}
.a-card--r-xl {
  border-radius: var(--radius-xl);
}
.a-card--r-2xl {
  border-radius: var(--radius-2xl);
}
</style>
