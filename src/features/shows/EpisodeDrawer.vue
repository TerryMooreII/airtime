<script setup lang="ts">
import { computed } from 'vue'

import { ADrawer, AButton, APoster } from '@/design-system'
import { episodeCode, formatDateTime, formatRuntime, stripHtml } from '@/lib/format'
import type { Episode } from '@/types/domain'

const props = defineProps<{
  episode: Episode | null
  episodes: Episode[]
  showName: string
  showImage: string | null
  timezone: string
  rating?: number
}>()
const emit = defineEmits<{ close: []; navigate: [episode: Episode] }>()

const index = computed(() => (props.episode ? props.episodes.findIndex((e) => e.id === props.episode!.id) : -1))
const prev = computed(() => (index.value > 0 ? props.episodes[index.value - 1] : undefined))
const next = computed(() => (index.value >= 0 ? props.episodes[index.value + 1] : undefined))
const meta = computed(() => {
  if (!props.episode) return ''
  return [formatDateTime(props.episode.airstamp, props.timezone), formatRuntime(props.episode.runtime)].filter(Boolean).join(' · ')
})
</script>

<template>
  <ADrawer :open="!!episode" :title="episode?.name ?? 'Episode'" @close="emit('close')">
    <template v-if="episode">
      <APoster :src="episode.image_medium ?? showImage" ratio="still" radius="sm" class="ep__img" />
      <div class="ep__body">
        <span class="ep__kicker">{{ showName }} · {{ episodeCode(episode.season, episode.number) }}</span>
        <h2 class="ep__title">{{ episode.name ?? 'TBA' }}</h2>
        <span class="ep__meta">{{ meta }}</span>
        <span class="ep__avg">{{ rating ? `★ ${rating} average on TVmaze` : 'Not yet rated on TVmaze' }}</span>
        <p class="ep__summary">{{ stripHtml(episode.summary_html) || 'No synopsis yet.' }}</p>
        <div class="ep__nav">
          <AButton variant="outline" :disabled="!prev" icon="back" @click="prev && emit('navigate', prev)">Previous</AButton>
          <AButton variant="outline" :disabled="!next" @click="next && emit('navigate', next)">Next</AButton>
        </div>
      </div>
    </template>
  </ADrawer>
</template>

<style scoped>
.ep__img {
  border-radius: 0;
  flex: none;
}
.ep__body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ep__kicker {
  font: 600 11.5px var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--primary-text);
}
.ep__title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.08;
}
.ep__meta {
  font: 500 13px var(--font-mono);
  color: var(--muted);
}
.ep__avg {
  font-size: 14px;
  color: var(--muted);
}
.ep__summary {
  margin-top: 4px;
  font-size: 15.5px;
  line-height: 1.6;
  text-wrap: pretty;
}
.ep__nav {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.ep__nav > * {
  flex: 1;
}
</style>
