<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean; name?: string }>(), {
  compact: false,
  name: 'Airtime',
})
</script>

<template>
  <div class="a-logo" :class="{ 'a-logo--compact': compact }">
    <div class="a-logo__mark"><span class="a-logo__dot" /></div>
    <span v-if="!compact" class="a-logo__name">{{ name }}</span>
  </div>
</template>

<style scoped>
.a-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.a-logo__mark {
  width: 22px;
  height: 16px;
  border: 2.5px solid var(--primary);
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.a-logo__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
}
.a-logo__name {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.03em;
}
</style>
