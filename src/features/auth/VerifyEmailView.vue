<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AAlert, AButton } from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { useSignOut } from '@/composables/useSignOut'
import { useAuthStore } from '@/stores/auth'

import AuthFormShell from './AuthFormShell.vue'

const auth = useAuthStore()
const route = useRoute()

const email = computed(
  () => (typeof route.query.email === 'string' ? route.query.email : auth.user?.email) ?? '',
)
const sending = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)

async function resend() {
  if (!email.value) return
  sending.value = true
  error.value = null
  try {
    await auth.resendVerification(email.value)
    sent.value = true
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    sending.value = false
  }
}

const signOut = useSignOut()
</script>

<template>
  <AuthFormShell
    title="Check your email"
    :subtitle="`We sent a confirmation link to ${email || 'your inbox'}. Open it to activate your account.`"
  >
    <AAlert v-if="sent" variant="success">A new link is on its way.</AAlert>
    <AAlert v-if="error" variant="error">{{ error }}</AAlert>
    <div class="actions">
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

<style scoped>
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
