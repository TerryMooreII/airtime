<script setup lang="ts">
import { AIcon, APoster } from '@/design-system'
import { episodeNumberLabel } from '@/lib/episodes'
import { stripHtml } from '@/lib/format'
import type { Episode } from '@/types/domain'

/** One row of the episode list: still, code + title, meta, summary, watched toggle. */
defineProps<{
  episode: Episode
  /** Fallback artwork when the episode has none. */
  fallbackImage: string | null
  meta: string
  future: boolean
  watched: boolean
}>()
const emit = defineEmits<{ open: []; toggleWatched: [] }>()
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="episode"
    :class="{ 'episode--future': future, 'episode--watched': watched }"
    @click="emit('open')"
    @keydown.enter="emit('open')"
  >
    <APoster :src="episode.image_medium ?? fallbackImage" ratio="still" radius="md" />
    <span class="stack-tight">
      <span class="episode__title">
        <span class="episode__code t-mono">{{ episodeNumberLabel(episode.number) }}</span>
        <span class="truncate">{{ episode.name ?? 'TBA' }}</span>
      </span>
      <span class="episode__meta">{{ meta }}</span>
      <span class="episode__sum clamp-2">{{ stripHtml(episode.summary_html) }}</span>
    </span>
    <button
      v-if="!future"
      type="button"
      class="episode__check"
      :class="{ 'episode__check--on': watched }"
      :aria-label="watched ? 'Mark unwatched' : 'Mark watched'"
      :aria-pressed="watched"
      @click.stop="emit('toggleWatched')"
    >
      <AIcon name="check" :size="16" :stroke-width="2.6" />
    </button>
    <span v-else class="episode__check episode__check--spacer" aria-hidden="true" />
  </div>
</template>

<style scoped>
.episode {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) 36px;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-2_5) var(--space-2);
  margin: 0 -8px;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--fg);
  text-align: left;
  cursor: pointer;
}
.episode:hover {
  background: var(--hover);
}
.episode--future {
  opacity: 0.55;
}
.episode--watched .episode__title {
  color: var(--muted);
}
.episode__title {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
  font-size: var(--text-md);
  font-weight: 600;
}
.episode__code {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--primary-text);
  flex: none;
}
.episode__meta {
  font: 500 var(--text-xs) var(--font-mono);
  color: var(--muted);
}
.episode__sum {
  font-size: var(--text-sm);
  color: var(--muted);
  line-height: 1.45;
}
.episode__check {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid var(--line2);
  background: transparent;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  transition:
    background var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease),
    color var(--dur-fast) var(--ease);
}
.episode__check:hover {
  border-color: var(--primary);
  color: var(--primary-text);
}
.episode__check--on {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}
.episode__check--spacer {
  border-color: transparent;
}
@media (max-width: 759px) {
  .episode {
    grid-template-columns: 104px minmax(0, 1fr) 36px;
  }
  .episode__sum {
    display: none;
  }
}
</style>
