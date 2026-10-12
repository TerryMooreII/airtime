<script setup lang="ts">
import { computed } from 'vue'

import { ABrandIcon, AButton, AIcon, type Brand, type IconName } from '@/design-system'
import { externalLink, RATING_PROVIDER_LABELS } from '@/lib/api/shows'
import { episodeCode, formatAirTime, relativeDayLabel, stripHtml } from '@/lib/format'
import type { Episode, LibraryEntry, Show, ShowExternalId } from '@/types/domain'

/** Synopsis and outbound links, with the next episode and alert toggle beside them. */
const props = defineProps<{
  show: Show
  externalIds: ShowExternalId[]
  nextEpisode: Episode | undefined
  entry: LibraryEntry | undefined
  tz: string
}>()
const emit = defineEmits<{ setNotify: [notify: boolean] }>()

interface ShowLink {
  label: string
  href: string
  icon: IconName
  brand?: Brand
}
const links = computed<ShowLink[]>(() => {
  const out: ShowLink[] = []
  if (props.show.tvmaze_url)
    out.push({ label: 'TVmaze', href: props.show.tvmaze_url, icon: 'tv', brand: 'tvmaze' })
  for (const x of props.externalIds) {
    const href = externalLink(x.provider, x.external_id)
    if (!href) continue
    out.push({
      label: RATING_PROVIDER_LABELS[x.provider] ?? x.provider,
      href,
      icon: x.provider === 'imdb' ? 'film' : 'database',
      brand: x.provider === 'imdb' ? 'imdb' : x.provider === 'thetvdb' ? 'thetvdb' : undefined,
    })
  }
  if (props.show.official_site)
    out.push({ label: 'Official site', href: props.show.official_site, icon: 'globe' })
  return out
})
</script>

<template>
  <section class="about">
    <div class="about__text">
      <span class="t-label">About</span>
      <p class="about__summary">{{ stripHtml(show.summary_html) || 'No synopsis available.' }}</p>
      <div v-if="links.length" class="cluster about__links">
        <AButton
          v-for="l in links"
          :key="l.href"
          :href="l.href"
          variant="outline"
          size="sm"
          :icon="l.icon"
        >
          <template v-if="l.brand" #icon><ABrandIcon :brand="l.brand" :size="18" /></template>
          {{ l.label }}<AIcon name="external" :size="13" class="about__ext" />
        </AButton>
      </div>
    </div>
    <div class="about__side">
      <div v-if="nextEpisode" class="next">
        <span class="t-kicker"
          >Next episode · {{ relativeDayLabel(nextEpisode.airstamp!, tz) }}</span
        >
        <span class="next__title">{{ nextEpisode.name ?? 'TBA' }}</span>
        <span class="t-meta"
          >{{ episodeCode(nextEpisode.season, nextEpisode.number) }} ·
          {{ formatAirTime(nextEpisode.airstamp, tz) }}</span
        >
      </div>
      <div v-if="entry" class="alerts">
        <div class="stack-tight">
          <span class="alerts__title">Episode alerts</span>
          <span class="alerts__desc">{{
            entry.notify ? 'You will be told when new episodes air.' : 'Muted for this show.'
          }}</span>
        </div>
        <AButton
          variant="outline"
          size="sm"
          :icon="entry.notify ? 'bellOff' : 'bell'"
          @click="emit('setNotify', !entry.notify)"
          >{{ entry.notify ? 'Mute' : 'Unmute' }}</AButton
        >
      </div>
    </div>
  </section>
</template>

<style scoped>
.about {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: var(--space-6);
  align-items: start;
}
.about__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
}
.about__summary {
  font-size: var(--text-md);
  line-height: 1.6;
  text-wrap: pretty;
  max-width: 68ch;
}
.about__links {
  margin-top: var(--space-1_5);
}
.about__ext {
  color: var(--muted);
  margin-left: -2px;
}
.about__side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.next {
  border-radius: var(--radius-xl);
  background: var(--primary-soft);
  padding: var(--space-4_5);
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}
.next__title {
  font-size: var(--text-lg);
  font-weight: 600;
}
.alerts {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3_5) var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid var(--line);
  background: var(--surface);
}
.alerts__title {
  font-size: var(--text-base);
  font-weight: 600;
}
.alerts__desc {
  font-size: var(--text-xs);
  color: var(--muted);
}
@media (max-width: 759px) {
  .about {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
