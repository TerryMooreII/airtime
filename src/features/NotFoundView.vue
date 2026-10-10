<script setup lang="ts">
import { AButton, AEmptyState, ALogo } from '@/design-system'
import { useTheme } from '@/composables/useTheme'

useTheme()
</script>

<template>
  <div class="nf">
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 24px;
}
</style>
