<script setup lang="ts">
import AButton from './AButton.vue'

withDefaults(defineProps<{ loading?: boolean; label?: string }>(), {
  loading: false,
  label: 'Load more',
})
const emit = defineEmits<{ more: [] }>()
</script>

<template>
  <div class="a-load-more">
    <AButton variant="outline" :loading="loading" @click="emit('more')">{{ label }}</AButton>
  </div>
</template>

<style scoped>
.a-load-more {
  display: flex;
  justify-content: center;
}
</style>
