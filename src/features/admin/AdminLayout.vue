<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

const tabs = [
  { name: 'admin', label: 'Overview' },
  { name: 'admin-shows', label: 'Shows' },
  { name: 'admin-users', label: 'Users' },
  { name: 'admin-sync', label: 'Sync' },
]
</script>

<template>
  <div class="admin">
    <div class="admin__head">
      <div>
        <span class="t-label admin__kicker">Admin</span>
        <h1 class="t-h1">Management</h1>
      </div>
      <nav class="admin__tabs" aria-label="Admin sections">
        <RouterLink
          v-for="t in tabs"
          :key="t.name"
          :to="{ name: t.name }"
          class="admin__tab"
          active-class="admin__tab--on"
          :exact-active-class="t.name === 'admin' ? 'admin__tab--on' : undefined"
          exact
          >{{ t.label }}</RouterLink
        >
      </nav>
    </div>
    <RouterView />
  </div>
</template>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.admin__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.admin__kicker {
  color: var(--primary-text);
}
.admin__tabs {
  display: flex;
  padding: 3px;
  background: var(--surface2);
  border-radius: var(--radius-md);
  gap: 2px;
}
.admin__tab {
  font-size: 13px;
  font-weight: 500;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  color: var(--muted);
}
.admin__tab--on {
  background: var(--surface);
  color: var(--fg);
  box-shadow: var(--shadow-seg);
}
</style>
