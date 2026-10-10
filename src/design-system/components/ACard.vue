<script setup lang="ts">
withDefaults(defineProps<{ padding?: 'none' | 'sm' | 'md' | 'lg'; radius?: 'lg' | 'xl' | '2xl'; interactive?: boolean }>(), {
  padding: 'md',
  radius: 'xl',
  interactive: false,
})
</script>

<template>
  <div class="a-card" :class="[`a-card--p-${padding}`, `a-card--r-${radius}`, { 'a-card--interactive': interactive }]">
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
  transition: border-color var(--dur-fast);
}
.a-card--interactive {
  cursor: pointer;
}
.a-card--interactive:hover {
  border-color: var(--line2);
}
.a-card--p-none {
  padding: 0;
}
.a-card--p-sm {
  padding: 12px;
}
.a-card--p-md {
  padding: 16px;
}
.a-card--p-lg {
  padding: 18px 20px;
}
.a-card--r-lg {
  border-radius: var(--radius-lg);
}
.a-card--r-xl {
  border-radius: var(--radius-xl);
}
.a-card--r-2xl {
  border-radius: var(--radius-2xl);
}
</style>
