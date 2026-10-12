<script setup lang="ts">
import { AInput } from '@/design-system'

/** The email input shared by the sign-in, register and reset forms. */
const model = defineModel<string>({ default: '' })
</script>

<template>
  <AInput
    v-model="model"
    label="Email"
    type="email"
    autocomplete="email"
    icon="mail"
    placeholder="you@example.com"
    required
  />
</template>
