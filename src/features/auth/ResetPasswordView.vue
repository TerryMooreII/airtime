<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AAlert, AButton, AInput } from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

import AuthFormShell from './AuthFormShell.vue'
import { usePasswordPair } from './usePasswordPair'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const { password, confirm, passwordError, confirmError, valid } = usePasswordPair()
const ready = ref(false)

const BAD_LINK = 'This reset link is invalid or has expired. Request a new one.'

const {
  loading,
  error,
  run: submit,
} = useAsync(async () => {
  if (!valid.value) return
  await auth.updatePassword(password.value)
  ui.success('Password updated')
  await router.replace({ name: 'home' })
})

onMounted(async () => {
  // The recovery link lands here with a PKCE code; the client exchanges it for a session.
  const failed = await auth.exchangeCodeFromUrl()
  await auth.init()
  ready.value = auth.isAuthenticated
  if (failed || !ready.value) error.value = BAD_LINK
})
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
