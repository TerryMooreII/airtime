<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { AFollowButton, APoster } from '@/design-system'
import { endsAt, formatCountdown, isLive } from '@/lib/episodes'
import { episodeCode, formatAirTime } from '@/lib/format'
import type { UpcomingEpisode } from '@/types/domain'

/** One episode in the agenda or a day's list: time, poster, show + episode, countdown. */
withDefaults(
  defineProps<{
    episode: UpcomingEpisode
    tz: string
    now: number
    /** Show "On now" / premiere badges. */
    badges?: boolean
    /** Show the countdown on the right (hidden on phones). */
    countdown?: boolean
    /** Offer the follow chip (catalog-wide scope). */
    canFollow?: boolean
    following?: boolean
    followPending?: boolean
  }>(),
  { badges: true, countdown: true, canFollow: false, following: false, followPending: false },
)
const emit = defineEmits<{ toggleFollow: [] }>()
</script>

<template>
  <RouterLink
    :to="{ name: 'show', params: { id: episode.show_id } }"
    class="row"
    :class="{ 'row--past': endsAt(episode) < now }"
  >
    <span class="row__time t-mono">{{ formatAirTime(episode.airstamp, tz) }}</span>
    <APoster :src="episode.show_image" radius="sm" />
    <span class="stack-tight">
      <span class="row__title">
        <span class="row__name truncate">{{ episode.show_name }}</span>
        <template v-if="badges">
          <span v-if="isLive(episode, now)" class="row__badge row__badge--live">On now</span>
          <span v-else-if="episode.number === 1" class="row__badge">{{
            episode.season === 1 ? 'Series premiere' : 'Season premiere'
          }}</span>
        </template>
      </span>
      <span class="row__ep truncate"
        ><span class="t-mono row__code">{{ episodeCode(episode.season, episode.number) }}</span> ·
        {{ episode.episode_name ?? 'TBA' }}</span
      >
    </span>
    <span class="row__end">
      <AFollowButton
        v-if="canFollow"
        :following="following"
        :loading="followPending"
        appearance="chip"
        inline
        small
        @toggle="emit('toggleFollow')"
      />
      <span v-if="countdown" class="row__rel t-mono">{{ formatCountdown(episode, now) }}</span>
    </span>
  </RouterLink>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 76px 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3_5);
  padding: var(--space-2_5) var(--space-2);
  margin: 0 -8px;
  border-radius: var(--radius-lg);
  color: var(--fg);
}
.row:hover {
  background: var(--hover);
}
.row--past {
  opacity: 0.45;
}
.row__time {
  font-weight: 500;
  font-size: var(--text-sm);
}
.row__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.row__name {
  font-weight: 600;
  font-size: var(--text-md);
}
.row__badge {
  flex: none;
  font: 600 var(--text-2xs) var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 6px;
  border-radius: 5px;
  background: var(--primary-soft);
  color: var(--primary-text);
}
.row__badge--live {
  background: var(--primary);
  color: var(--on-primary);
}
.row__ep {
  font-size: var(--text-base);
  color: var(--muted);
}
.row__code {
  font-size: var(--text-xs);
}
.row__end {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
}
.row__rel {
  font-size: var(--text-xs);
  color: var(--primary-text);
  white-space: nowrap;
}
@media (max-width: 759px) {
  .row {
    grid-template-columns: 56px 38px minmax(0, 1fr) auto;
  }
  .row__rel {
    display: none;
  }
}
</style>
