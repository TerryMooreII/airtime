<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AAlert, AButton, AInput } from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'

import AuthFormShell from './AuthFormShell.vue'
import EmailField from './EmailField.vue'
import { usePasswordPair } from './usePasswordPair'

const auth = useAuthStore()
const router = useRouter()

const displayName = ref('')
const email = ref('')
const { password, confirm, passwordError, confirmError, valid, hint } = usePasswordPair()

const {
  loading,
  error,
  run: submit,
} = useAsync(async () => {
  if (!valid.value) return
  const { needsVerification } = await auth.signUp(
    email.value.trim(),
    password.value,
    displayName.value.trim(),
  )
  await router.replace(
    needsVerification
      ? { name: 'verify-email', query: { email: email.value.trim() } }
      : { name: 'home' },
  )
})
</script>

<template>
  <AuthFormShell
    title="Create your account"
    subtitle="Track the shows you love and get told when new episodes land."
  >
    <form @submit.prevent="submit">
      <AAlert v-if="error" variant="error">{{ error }}</AAlert>
      <AInput
        v-model="displayName"
        label="Name"
        autocomplete="name"
        icon="user"
        placeholder="How should we call you?"
        required
      />
      <EmailField v-model="email" />
      <AInput
        v-model="password"
        label="Password"
        type="password"
        autocomplete="new-password"
        icon="lock"
        :error="passwordError"
        :hint="hint"
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
      <AButton type="submit" size="lg" block :loading="loading">Create account</AButton>
    </form>
    <template #footer>
      <span>Already have an account? <RouterLink :to="{ name: 'login' }">Sign in</RouterLink></span>
    </template>
  </AuthFormShell>
</template>
