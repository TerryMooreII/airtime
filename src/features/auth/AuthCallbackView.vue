<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AAlert, AIcon } from '@/design-system'
import { useAuthStore } from '@/stores/auth'

import AuthFormShell from './AuthFormShell.vue'

const auth = useAuthStore()
const router = useRouter()
const error = ref<string | null>(null)

onMounted(async () => {
  const failed = await auth.exchangeCodeFromUrl()
  if (failed) {
    error.value = failed
    return
  }
  await auth.init()
  await auth.loadProfile()
  await router.replace(auth.isAuthenticated ? { name: 'home' } : { name: 'login' })
})
</script>

<template>
  <AuthFormShell title="Signing you in">
    <AAlert v-if="error" variant="error">{{ error }}</AAlert>
    <div v-else class="spin"><AIcon name="spinner" :size="22" /> One moment…</div>
    <template #footer>
      <RouterLink v-if="error" :to="{ name: 'login' }">Back to sign in</RouterLink>
    </template>
  </AuthFormShell>
</template>

<style scoped>
.spin {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  color: var(--muted);
}
</style>
