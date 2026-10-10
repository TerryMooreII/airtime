<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import { AToaster } from '@/design-system'
import AppLayout from '@/features/layout/AppLayout.vue'
import AuthLayout from '@/features/layout/AuthLayout.vue'

const route = useRoute()
const layout = computed(() => route.meta.layout ?? 'app')
</script>

<template>
  <AuthLayout v-if="layout === 'auth'"><RouterView /></AuthLayout>
  <RouterView v-else-if="layout === 'blank'" />
  <AppLayout v-else><RouterView /></AppLayout>
  <AToaster />
</template>
