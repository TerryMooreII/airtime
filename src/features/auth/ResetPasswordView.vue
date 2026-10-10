<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AAlert, AButton, AInput } from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

import AuthFormShell from './AuthFormShell.vue'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const password = ref('')
const confirm = ref('')
const loading = ref(false)
const ready = ref(false)
const error = ref<string | null>(null)

const passwordError = computed(() =>
  password.value && password.value.length < 8 ? 'Use at least 8 characters.' : null,
)
const confirmError = computed(() =>
  confirm.value && confirm.value !== password.value ? 'Passwords do not match.' : null,
)

onMounted(async () => {
  // The recovery link lands here with a code (PKCE) or a hash fragment; the client exchanges it.
  const code = new URLSearchParams(window.location.search).get('code')
  if (code) {
    const { error: err } = await supabase.auth.exchangeCodeForSession(code)
    if (err) error.value = 'This reset link is invalid or has expired. Request a new one.'
  }
  await auth.init()
  const { data } = await supabase.auth.getSession()
  ready.value = Boolean(data.session)
  if (!ready.value && !error.value)
    error.value = 'This reset link is invalid or has expired. Request a new one.'
})

async function submit() {
  if (passwordError.value || confirmError.value) return
  loading.value = true
  try {
    await auth.updatePassword(password.value)
    ui.success('Password updated')
    await router.replace({ name: 'home' })
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthFormShell title="Choose a new password">
    <AAlert v-if="error" variant="error">{{ error }}</AAlert>
    <form v-if="ready" @submit.prevent="submit">
      <AInput
        v-model="password"
        label="New password"
        type="password"
        autocomplete="new-password"
        icon="lock"
        :error="passwordError"
        required
      />
      <AInput
        v-model="confirm"
        label="Confirm password"
        type="password"
        autocomplete="new-password"
        icon="lock"
        :error="confirmError"
        required
      />
      <AButton type="submit" size="lg" block :loading="loading">Update password</AButton>
    </form>
    <template #footer>
      <RouterLink :to="{ name: 'forgot-password' }">Request a new link</RouterLink>
    </template>
  </AuthFormShell>
</template>
