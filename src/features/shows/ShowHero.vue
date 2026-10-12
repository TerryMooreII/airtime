<script setup lang="ts">
import { computed } from 'vue'

import {
  ABadge,
  AChoiceGroup,
  AFollowButton,
  AIcon,
  AMediaHero,
  APoster,
  AStarRating,
} from '@/design-system'
import { RATING_PROVIDER_LABELS } from '@/lib/api/shows'
import { formatRuntime, yearOf } from '@/lib/format'
import {
  USER_SHOW_STATUSES,
  type LibraryEntry,
  type Show,
  type ShowRating,
  type UserShowStatus,
} from '@/types/domain'

/** Title banner: artwork, genres, meta line, ratings, follow button and status pills. */
const props = defineProps<{
  show: Show
  entry: LibraryEntry | undefined
  ratings: ShowRating[]
  followPending: boolean
}>()
const emit = defineEmits<{
  rate: [rating: number | null]
  setStatus: [status: UserShowStatus]
  follow: []
}>()

/** Where it airs: the TV network with its country, else the streaming service. */
const channel = computed(() => {
  const s = props.show
  if (s.network)
    return {
      kind: 'network' as const,
      label: [s.network.name, s.network.country_code].filter(Boolean).join(' · '),
    }
  if (s.web_channel) return { kind: 'web_channel' as const, label: s.web_channel.name }
  return null
})
const meta = computed(() => {
  const s = props.show
  const years = s.premiered ? `${yearOf(s.premiered)}–${s.ended ? yearOf(s.ended) : ''}` : null
  return [
    years,
    s.network?.name ?? s.web_channel?.name,
    s.status,
    formatRuntime(s.runtime ?? s.average_runtime),
  ]
    .filter(Boolean)
    .join('  ·  ') // wide dots: this line sits under the title
})
const tvmazeRating = computed(() => props.ratings.find((r) => r.provider === 'tvmaze'))
const otherRatings = computed(() => props.ratings.filter((r) => r.provider !== 'tvmaze'))
</script>

<template>
  <AMediaHero
    :title="show.name"
    :backdrop="show.image_original ?? show.image_medium"
    :meta="meta"
    size="xl"
    :media-width="210"
  >
    <template #media><APoster :src="show.image_medium" :alt="show.name" radius="lg" /></template>
    <template #above>
      <div v-if="show.genres.length || channel" class="cluster hero__genres">
        <ABadge v-if="channel" variant="soft" :mono="false" class="hero__channel">
          <AIcon :name="channel.kind === 'network' ? 'tv' : 'play'" :size="13" />{{ channel.label }}
        </ABadge>
        <ABadge v-for="g in show.genres" :key="g" variant="outline" :mono="false">{{ g }}</ABadge>
      </div>
    </template>
    <div class="hero__ratings">
      <div class="score">
        <span class="t-label">TVmaze</span>
        <span class="score__value">★ {{ tvmazeRating ? tvmazeRating.value : '—' }}</span>
      </div>
      <div v-for="r in otherRatings" :key="r.provider" class="score">
        <span class="t-label">{{ RATING_PROVIDER_LABELS[r.provider] ?? r.provider }}</span>
        <span class="score__value"
          >{{ r.value }}<span class="score__scale">/{{ r.scale }}</span></span
        >
      </div>
      <div class="score">
        <span class="t-label"
          >Your rating · {{ entry?.rating ? `${entry.rating}/5` : 'tap to rate' }}</span
        >
        <AStarRating
          :model-value="entry?.rating ?? null"
          size="lg"
          @update:model-value="emit('rate', $event)"
        />
      </div>
      <AFollowButton
        :following="!!entry"
        :loading="followPending"
        size="lg"
        @toggle="emit('follow')"
      />
    </div>
    <AChoiceGroup
      variant="pills"
      :model-value="entry?.status ?? ''"
      :options="USER_SHOW_STATUSES"
      aria-label="Watch status"
      class="hero__status"
      @update:model-value="emit('setStatus', $event as UserShowStatus)"
    />
  </AMediaHero>
</template>

<style scoped>
.hero__channel {
  gap: var(--space-1_5);
}
.hero__genres {
  --cluster-gap: var(--space-1_5);
}
.hero__ratings {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
  align-items: flex-end;
  margin-top: var(--space-1_5);
}
.score {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.score__value {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.score__scale {
  font-size: var(--text-base);
  color: var(--muted);
  font-weight: 500;
}
.hero__status {
  margin-top: var(--space-1);
}
</style>
