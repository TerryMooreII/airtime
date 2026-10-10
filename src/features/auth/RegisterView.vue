<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AAlert, AButton, AInput } from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'

import AuthFormShell from './AuthFormShell.vue'

const auth = useAuthStore()
const router = useRouter()

const displayName = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const passwordError = computed(() =>
  password.value && password.value.length < 8 ? 'Use at least 8 characters.' : null,
)
const confirmError = computed(() =>
  confirm.value && confirm.value !== password.value ? 'Passwords do not match.' : null,
)

async function submit() {
  if (passwordError.value || confirmError.value) return
  loading.value = true
  error.value = null
  try {
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
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
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
      <AInput
        v-model="email"
        label="Email"
        type="email"
        autocomplete="email"
        icon="mail"
        placeholder="you@example.com"
        required
      />
      <AInput
        v-model="password"
        label="Password"
        type="password"
        autocomplete="new-password"
        icon="lock"
        :error="passwordError"
        hint="At least 8 characters."
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
