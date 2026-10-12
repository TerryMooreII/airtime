<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AAlert, AButton, AInput } from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'

import AuthFormShell from './AuthFormShell.vue'
import EmailField from './EmailField.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')

const {
  loading,
  error,
  run: submit,
} = useAsync(async () => {
  await auth.signIn(email.value.trim(), password.value)
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  await router.replace(redirect)
})
</script>

<template>
  <AuthFormShell title="Welcome back" subtitle="Sign in to see what's airing this week.">
    <form @submit.prevent="submit">
      <AAlert v-if="error" variant="error">{{ error }}</AAlert>
      <EmailField v-model="email" />
      <AInput
        v-model="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        icon="lock"
        required
      />
      <AButton type="submit" size="lg" block :loading="loading">Sign in</AButton>
    </form>
    <template #footer>
      <RouterLink :to="{ name: 'forgot-password' }">Forgot password?</RouterLink>
      <span>New here? <RouterLink :to="{ name: 'register' }">Create an account</RouterLink></span>
    </template>
  </AuthFormShell>
</template>
