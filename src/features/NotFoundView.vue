<script setup lang="ts">
import { AButton, AEmptyState, ALogo } from '@/design-system'
import { useTheme } from '@/composables/useTheme'

useTheme()
</script>

<template>
  <div class="page nf">
    <ALogo />
    <AEmptyState
      title="Page not found"
      description="That link doesn't go anywhere. Head back to your guide."
    >
      <AButton :to="{ name: 'home' }">Go home</AButton>
    </AEmptyState>
  </div>
</template>

<style scoped>
.nf {
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}
</style>
