<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AAlert, AButton, AInput } from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'

import AuthFormShell from './AuthFormShell.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function submit() {
  loading.value = true
  error.value = null
  try {
    await auth.signIn(email.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthFormShell title="Welcome back" subtitle="Sign in to see what's airing this week.">
    <form @submit.prevent="submit">
      <AAlert v-if="error" variant="error">{{ error }}</AAlert>
      <AInput v-model="email" label="Email" type="email" autocomplete="email" icon="mail" placeholder="you@example.com" required />
      <AInput v-model="password" label="Password" type="password" autocomplete="current-password" icon="lock" required />
      <AButton type="submit" size="lg" block :loading="loading">Sign in</AButton>
    </form>
    <template #footer>
      <RouterLink :to="{ name: 'forgot-password' }">Forgot password?</RouterLink>
      <span>New here? <RouterLink :to="{ name: 'register' }">Create an account</RouterLink></span>
    </template>
  </AuthFormShell>
</template>
