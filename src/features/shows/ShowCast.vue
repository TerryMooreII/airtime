<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { AAlert, AEmptyState, APersonCard, ASkeleton } from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { fetchShowCast } from '@/lib/tvmaze'
import type { CastMember } from '@/types/domain'

/** The Cast tab. Cast comes live from TVmaze and is fetched when the tab first opens. */
const props = defineProps<{ tvmazeId: number }>()
const emit = defineEmits<{ loaded: [count: number] }>()

const cast = ref<CastMember[] | null>(null)
const {
  loading,
  error,
  run: load,
} = useAsync(async () => {
  cast.value = await fetchShowCast(props.tvmazeId)
  emit('loaded', cast.value.length)
})
onMounted(load)
watch(() => props.tvmazeId, load)

function role(c: CastMember): string {
  if (c.self) return 'Themself'
  return c.character ?? ''
}
</script>

<template>
  <section class="cast">
    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>
    <div v-else-if="loading || cast === null" class="cast__grid">
      <div v-for="i in 8" :key="i" class="cast__skeleton">
        <ASkeleton width="76px" height="76px" radius="50%" />
        <ASkeleton width="70%" height="12px" />
        <ASkeleton width="50%" height="10px" />
      </div>
    </div>
    <AEmptyState
      v-else-if="!cast.length"
      title="No cast listed"
      description="TVmaze doesn't have cast information for this show yet."
      compact
    />
    <div v-else class="cast__grid">
      <APersonCard
        v-for="c in cast"
        :key="c.personId"
        :name="c.name"
        :image="c.image"
        :role="role(c)"
        :tag="c.voice ? 'voice' : undefined"
        :to="{ name: 'person', params: { id: c.personId } }"
      />
    </div>
    <p class="t-muted cast__credit">Cast data from TVmaze.</p>
  </section>
</template>

<style scoped>
.cast {
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
}
.cast__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: var(--space-2_5) var(--space-1_5);
}
.cast__skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-1);
}
.cast__credit {
  font-size: var(--text-xs);
}
</style>
