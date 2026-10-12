<script setup lang="ts">
import { computed } from 'vue'

import { AButton, ADrawer, APoster } from '@/design-system'
import { episodeCode, formatDateTime, formatRuntime, stripHtml } from '@/lib/format'
import type { Episode } from '@/types/domain'

const props = defineProps<{
  episode: Episode | null
  episodes: Episode[]
  showName: string
  showImage: string | null
  timezone: string
  rating?: number
  watched?: boolean
  canWatch?: boolean
}>()
const emit = defineEmits<{ close: []; navigate: [episode: Episode]; toggleWatched: [] }>()

const index = computed(() =>
  props.episode ? props.episodes.findIndex((e) => e.id === props.episode!.id) : -1,
)
const prev = computed(() => (index.value > 0 ? props.episodes[index.value - 1] : undefined))
const next = computed(() => (index.value >= 0 ? props.episodes[index.value + 1] : undefined))
const meta = computed(() => {
  if (!props.episode) return ''
  return [
    formatDateTime(props.episode.airstamp, props.timezone),
    formatRuntime(props.episode.runtime),
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <ADrawer :open="!!episode" :title="episode?.name ?? 'Episode'" @close="emit('close')">
    <template v-if="episode">
      <APoster
        :src="episode.image_medium ?? showImage"
        ratio="still"
        radius="none"
        class="ep__img"
      />
      <div class="ep__body">
        <span class="t-kicker"
          >{{ showName }} · {{ episodeCode(episode.season, episode.number) }}</span
        >
        <h2 class="ep__title">{{ episode.name ?? 'TBA' }}</h2>
        <span class="t-meta">{{ meta }}</span>
        <span class="ep__avg">{{
          rating ? `★ ${rating} average on TVmaze` : 'Not yet rated on TVmaze'
        }}</span>
        <AButton
          v-if="canWatch"
          size="lg"
          :variant="watched ? 'primary' : 'outline'"
          :icon="watched ? 'check' : undefined"
          @click="emit('toggleWatched')"
          >{{ watched ? 'Watched' : 'Mark as watched' }}</AButton
        >
        <p class="ep__summary">{{ stripHtml(episode.summary_html) || 'No synopsis yet.' }}</p>
        <div class="ep__nav">
          <AButton
            variant="outline"
            :disabled="!prev"
            icon="back"
            @click="prev && emit('navigate', prev)"
            >Previous</AButton
          >
          <AButton variant="outline" :disabled="!next" @click="next && emit('navigate', next)"
            >Next</AButton
          >
        </div>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped>
.ep__img {
  flex: none;
}
.ep__body {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
}
.ep__title {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.08;
}
.ep__avg {
  font-size: var(--text-base);
  color: var(--muted);
}
.ep__summary {
  margin-top: var(--space-1);
  font-size: var(--text-md);
  line-height: 1.6;
  text-wrap: pretty;
}
.ep__nav {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.ep__nav > * {
  flex: 1;
}
</style>
