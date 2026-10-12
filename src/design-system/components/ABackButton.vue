<script setup lang="ts">
import { useRouter, type RouteLocationRaw } from 'vue-router'

import AButton from './AButton.vue'

/** Goes back in history, or to `fallback` when the page was opened directly. */
const props = withDefaults(defineProps<{ fallback?: RouteLocationRaw; label?: string }>(), {
  fallback: '/',
  label: 'Back',
})
const router = useRouter()

function back() {
  if (window.history.state?.back) router.back()
  else void router.push(props.fallback)
}
</script>

<template>
  <div>
    <AButton variant="ghost" size="sm" icon="back" @click="back">{{ label }}</AButton>
  </div>
</template>
