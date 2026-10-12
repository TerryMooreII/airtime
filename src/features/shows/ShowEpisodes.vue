<script setup lang="ts">
import { AButton, AChoiceGroup, AHeader, AProgressBar, ASkeleton } from '@/design-system'
import { plural } from '@/lib/format'
import type { Episode } from '@/types/domain'

import EpisodeRow from './EpisodeRow.vue'
import type { ShowEpisodesState } from './useShowEpisodes'

/** The Episodes tab: season picker, progress, the list. State comes from useShowEpisodes(). */
defineProps<{
  state: ShowEpisodesState
  fallbackImage: string | null
  /** A TVmaze refresh is in flight. */
  syncing: boolean
}>()
const emit = defineEmits<{ open: [episode: Episode]; refresh: [] }>()
</script>

<template>
  <section class="episodes">
    <AHeader
      level="section"
      title="Episodes"
      :subtitle="syncing ? 'Syncing from TVmaze…' : undefined"
    >
      <AButton
        v-if="state.airedSeasonIds.length"
        variant="outline"
        size="sm"
        :icon="state.allSeasonWatched ? 'minus' : 'check'"
        @click="state.toggleSeason()"
        >{{ state.allSeasonWatched ? 'Mark season unwatched' : 'Mark season watched' }}</AButton
      >
      <AButton v-if="!syncing" variant="ghost" size="sm" icon="refresh" @click="emit('refresh')"
        >Refresh</AButton
      >
    </AHeader>
    <AChoiceGroup
      v-if="state.seasons.length > 1"
      variant="pills"
      :model-value="state.season ?? -1"
      :options="state.seasonOptions"
      mono
      aria-label="Season"
      @update:model-value="state.setSeason(Number($event))"
    />
    <div v-if="state.airedSeasonIds.length" class="episodes__progress">
      <AProgressBar
        :value="state.seasonWatched"
        :max="state.airedSeasonIds.length"
        size="md"
        label="Season progress"
      />
      <span class="episodes__progress-label t-mono"
        >{{ state.seasonWatched }} of {{ state.airedSeasonIds.length }} watched</span
      >
    </div>
    <span class="episodes__count"
      >{{ plural(state.seasonEpisodes.length, 'episode')
      }}<template v-if="state.overallAired">
        · {{ state.overallWatched }} of {{ state.overallAired }} aired episodes watched
        overall</template
      ></span
    >

    <div v-if="!state.episodes.length && syncing" class="episodes__skeleton">
      <ASkeleton v-for="i in 4" :key="i" height="90px" />
    </div>
    <div v-else-if="state.seasonEpisodes.length" class="episodes__list">
      <EpisodeRow
        v-for="e in state.seasonEpisodes"
        :key="e.id"
        :episode="e"
        :fallback-image="fallbackImage"
        :meta="state.meta(e)"
        :future="state.isFuture(e)"
        :watched="state.isWatched(e)"
        @open="emit('open', e)"
        @toggle-watched="state.toggleWatched(e)"
      />
    </div>
    <p v-else class="t-sub">No episodes listed yet.</p>
  </section>
</template>

<style scoped>
.episodes {
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
}
.episodes__count {
  font-size: var(--text-sm);
  color: var(--muted);
  margin-top: -6px;
}
.episodes__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.episodes__list {
  display: flex;
  flex-direction: column;
}
.episodes__progress {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.episodes__progress-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--muted);
  white-space: nowrap;
}
</style>
