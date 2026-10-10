<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { AAlert, ABadge, AButton, AModal, ATable, type TableColumn } from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { banUser, deleteUser, listUsers, setUserRole } from '@/lib/api/admin'
import { timeAgo } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { AdminUser } from '@/types/domain'

const auth = useAuthStore()
const ui = useUiStore()
const users = ref<AdminUser[]>([])
const page = ref(1)
const total = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const busyId = ref<string | null>(null)
const confirmDelete = ref<AdminUser | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await listUsers(page.value, 50)
    users.value = res.users
    total.value = res.total
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function act(user: AdminUser, fn: () => Promise<unknown>, message: string) {
  busyId.value = user.id
  try {
    await fn()
    ui.success(message)
    await load()
  } catch (err) {
    ui.error(errorMessage(err))
  } finally {
    busyId.value = null
  }
}
const toggleRole = (u: AdminUser) => act(u, () => setUserRole(u.id, u.role === 'admin' ? 'user' : 'admin'), `${u.email} is now ${u.role === 'admin' ? 'a member' : 'an admin'}`)
const toggleBan = (u: AdminUser) => act(u, () => banUser(u.id, !isBanned(u)), isBanned(u) ? 'User unbanned' : 'User banned')
async function doDelete() {
  const u = confirmDelete.value
  if (!u) return
  await act(u, () => deleteUser(u.id), 'User deleted')
  confirmDelete.value = null
}
function isBanned(u: AdminUser): boolean {
  return !!u.banned_until && new Date(u.banned_until).getTime() > Date.now()
}

const columns: TableColumn[] = [
  { key: 'email', label: 'User' },
  { key: 'role', label: 'Role' },
  { key: 'tracked_shows', label: 'Shows', align: 'right' },
  { key: 'last_sign_in_at', label: 'Last seen' },
  { key: 'state', label: 'State' },
  { key: 'actions', label: '', align: 'right' },
]
</script>

<template>
  <div class="users">
    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>
    <ATable :columns="columns" :rows="users" :loading="loading">
      <template #cell-email="{ row }">
        <span class="user-cell">
          <span class="user-cell__name">{{ row.display_name || '—' }}</span>
          <span class="t-muted">{{ row.email }}</span>
        </span>
      </template>
      <template #cell-role="{ value }"><ABadge :variant="value === 'admin' ? 'soft' : 'muted'">{{ value }}</ABadge></template>
      <template #cell-last_sign_in_at="{ value }"><span class="t-muted">{{ value ? timeAgo(String(value)) : 'never' }}</span></template>
      <template #cell-state="{ row }">
        <ABadge v-if="isBanned(row as unknown as AdminUser)" variant="danger">banned</ABadge>
        <ABadge v-else-if="!row.email_confirmed_at" variant="warning">unverified</ABadge>
        <ABadge v-else variant="success">active</ABadge>
      </template>
      <template #cell-actions="{ row }">
        <div v-if="row.id !== auth.user?.id" class="actions">
          <AButton variant="outline" size="sm" :loading="busyId === row.id" @click="toggleRole(row as unknown as AdminUser)">{{ row.role === 'admin' ? 'Make member' : 'Make admin' }}</AButton>
          <AButton variant="outline" size="sm" :loading="busyId === row.id" @click="toggleBan(row as unknown as AdminUser)">{{ isBanned(row as unknown as AdminUser) ? 'Unban' : 'Ban' }}</AButton>
          <AButton variant="danger" size="sm" icon="trash" :loading="busyId === row.id" @click="confirmDelete = row as unknown as AdminUser">Delete</AButton>
        </div>
        <span v-else class="t-muted">you</span>
      </template>
    </ATable>
    <div class="pager">
      <span class="t-muted">Page {{ page }}<template v-if="total !== null"> · {{ total }} users</template></span>
      <div class="pager__btns">
        <AButton variant="outline" size="sm" :disabled="page === 1" @click="page--; load()">Previous</AButton>
        <AButton variant="outline" size="sm" :disabled="users.length < 50" @click="page++; load()">Next</AButton>
      </div>
    </div>

    <AModal
      :open="!!confirmDelete"
      title="Delete this user?"
      :description="`${confirmDelete?.email ?? ''} and everything they track will be removed permanently.`"
      confirm-label="Delete user"
      danger
      :loading="busyId === confirmDelete?.id"
      @close="confirmDelete = null"
      @confirm="doDelete"
    />
  </div>
</template>

<style scoped>
.users {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.user-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 180px;
}
.user-cell__name {
  font-weight: 600;
}
.actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}
.pager__btns {
  display: flex;
  gap: 6px;
}
</style>
