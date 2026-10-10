<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import { AAlert, AButton, AInput } from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'

import AuthFormShell from './AuthFormShell.vue'

const auth = useAuthStore()
const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)

async function submit() {
  loading.value = true
  error.value = null
  try {
    await auth.requestPasswordReset(email.value.trim())
    sent.value = true
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthFormShell title="Reset your password" subtitle="We'll email you a link to choose a new one.">
    <AAlert v-if="sent" variant="success" title="Check your inbox"
      >If an account exists for {{ email }}, a reset link is on its way.</AAlert
    >
    <form v-else @submit.prevent="submit">
      <AAlert v-if="error" variant="error">{{ error }}</AAlert>
      <AInput
        v-model="email"
        label="Email"
        type="email"
        autocomplete="email"
        icon="mail"
        placeholder="you@example.com"
        required
      />
      <AButton type="submit" size="lg" block :loading="loading">Send reset link</AButton>
    </form>
    <template #footer>
      <RouterLink :to="{ name: 'login' }">Back to sign in</RouterLink>
    </template>
  </AuthFormShell>
</template>
