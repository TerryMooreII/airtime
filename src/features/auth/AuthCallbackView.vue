<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AAlert, AIcon } from '@/design-system'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

import AuthFormShell from './AuthFormShell.vue'

const auth = useAuthStore()
const router = useRouter()
const error = ref<string | null>(null)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const described = params.get('error_description')
  if (described) {
    error.value = described
    return
  }
  if (code) {
    const { error: err } = await supabase.auth.exchangeCodeForSession(code)
    if (err) {
      error.value = err.message
      return
    }
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
  gap: 10px;
  color: var(--muted);
}
</style>
