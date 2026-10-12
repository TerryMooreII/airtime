<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AAlert, AButton } from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useSignOut } from '@/composables/useSignOut'
import { useAuthStore } from '@/stores/auth'

import AuthFormShell from './AuthFormShell.vue'

const auth = useAuthStore()
const route = useRoute()

const email = computed(
  () => (typeof route.query.email === 'string' ? route.query.email : auth.user?.email) ?? '',
)
const sent = ref(false)

const {
  loading: sending,
  error,
  run: resend,
} = useAsync(async () => {
  if (!email.value) return
  await auth.resendVerification(email.value)
  sent.value = true
})

const signOut = useSignOut()
</script>

<template>
  <AuthFormShell
    title="Check your email"
    :subtitle="`We sent a confirmation link to ${email || 'your inbox'}. Open it to activate your account.`"
  >
    <AAlert v-if="sent" variant="success">A new link is on its way.</AAlert>
    <AAlert v-if="error" variant="error">{{ error }}</AAlert>
    <div class="cluster actions">
      <AButton variant="outline" :loading="sending" :disabled="!email" @click="resend"
        >Resend email</AButton
      >
      <AButton v-if="auth.isAuthenticated" variant="ghost" @click="signOut"
        >Use a different account</AButton
      >
    </div>
    <template #footer>
      <span>Already confirmed? <RouterLink :to="{ name: 'login' }">Sign in</RouterLink></span>
    </template>
  </AuthFormShell>
</template>

<style scoped></style>
