<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import { AAlert, AButton } from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'

import AuthFormShell from './AuthFormShell.vue'
import EmailField from './EmailField.vue'

const auth = useAuthStore()
const email = ref('')
const sent = ref(false)

const {
  loading,
  error,
  run: submit,
} = useAsync(async () => {
  await auth.requestPasswordReset(email.value.trim())
  sent.value = true
})
</script>

<template>
  <AuthFormShell title="Reset your password" subtitle="We'll email you a link to choose a new one.">
    <AAlert v-if="sent" variant="success" title="Check your inbox"
      >If an account exists for {{ email }}, a reset link is on its way.</AAlert
    >
    <form v-else @submit.prevent="submit">
      <AAlert v-if="error" variant="error">{{ error }}</AAlert>
      <EmailField v-model="email" />
      <AButton type="submit" size="lg" block :loading="loading">Send reset link</AButton>
    </form>
    <template #footer>
      <RouterLink :to="{ name: 'login' }">Back to sign in</RouterLink>
    </template>
  </AuthFormShell>
</template>
