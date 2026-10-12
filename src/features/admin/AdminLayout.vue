<script setup lang="ts">
import { RouterView } from 'vue-router'

import { AChoiceGroup, AHeader } from '@/design-system'

const tabs = [
  { value: 'admin', label: 'Overview', to: { name: 'admin' } },
  { value: 'admin-shows', label: 'Shows', to: { name: 'admin-shows' } },
  { value: 'admin-users', label: 'Users', to: { name: 'admin-users' } },
  { value: 'admin-sync', label: 'Sync', to: { name: 'admin-sync' } },
]
</script>

<template>
  <div class="admin">
    <AHeader title="Management" kicker="Admin">
      <AChoiceGroup variant="segmented" :options="tabs" aria-label="Admin sections" />
    </AHeader>
    <RouterView />
  </div>
</template>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
