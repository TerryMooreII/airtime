<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { AEmptyState, AMediaRow } from '@/design-system'
import { formatCountdown } from '@/lib/episodes'
import { episodeCode, formatAirTime, formatRuntime, relativeDayLabel } from '@/lib/format'
import type { UpcomingEpisode } from '@/types/domain'

/** The next episode as a big artwork card, with the four after it beside it. */
defineProps<{ hero: UpcomingEpisode; then: UpcomingEpisode[]; tz: string; now: number }>()
</script>

<template>
  <div class="hero-grid">
    <RouterLink :to="{ name: 'show', params: { id: hero.show_id } }" class="hero">
      <img v-if="hero.show_image" :src="hero.show_image" alt="" class="hero__bg" />
      <div class="hero__shade" />
      <div class="hero__content">
        <span class="hero__badge">Up next · {{ formatCountdown(hero, now) }}</span>
        <span class="hero__name">{{ hero.show_name }}</span>
        <span class="hero__ep"
          ><span class="t-mono hero__code">{{ episodeCode(hero.season, hero.number) }}</span> —
          {{ hero.episode_name ?? 'TBA' }}</span
        >
        <span class="hero__when"
          >{{ relativeDayLabel(hero.airstamp, tz) }} · {{ formatAirTime(hero.airstamp, tz)
          }}<template v-if="hero.runtime"> · {{ formatRuntime(hero.runtime) }}</template></span
        >
      </div>
    </RouterLink>
    <div class="then">
      <div class="t-label then__title">Then</div>
      <AMediaRow
        v-for="e in then"
        :key="e.episode_id"
        :to="{ name: 'show', params: { id: e.show_id } }"
        :image="e.show_image"
        :image-width="40"
        :title="e.show_name"
        :subtitle="`${relativeDayLabel(e.airstamp, tz)} · ${formatAirTime(e.airstamp, tz)}`"
      >
        <span class="then__rel">{{ formatCountdown(e, now) }}</span>
      </AMediaRow>
      <AEmptyState v-if="!then.length" title="Nothing else yet" compact :dashed="false" />
    </div>
  </div>
</template>

<style scoped>
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: var(--space-4);
}
.hero {
  position: relative;
  min-height: 340px;
  border-radius: var(--radius-2xl);
  overflow: hidden;
  background: var(--image-bg);
  display: flex;
  color: var(--on-image);
}
.hero__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--dur-slow) var(--ease);
}
.hero:hover .hero__bg {
  transform: scale(1.03);
}
.hero__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.9) 8%,
    rgba(0, 0, 0, 0.35) 60%,
    rgba(0, 0, 0, 0.05)
  );
}
.hero__content {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: var(--space-8);
  gap: var(--space-2);
}
.hero__badge {
  align-self: flex-start;
  font: 600 var(--text-2xs) var(--font-mono);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  background: var(--primary);
  color: var(--on-primary);
  padding: 5px 9px;
  border-radius: var(--radius-badge);
}
.hero__name {
  font-size: var(--text-hero);
  font-weight: 700;
  letter-spacing: var(--tracking-tight);
  line-height: 1;
  text-wrap: balance;
}
.hero__ep {
  font-size: var(--text-md);
  color: var(--on-image);
  opacity: 0.88;
}
.hero__code {
  font-size: var(--text-sm);
}
.hero__when {
  font: 500 var(--text-sm) var(--font-mono);
  color: var(--on-image-muted);
}
.then {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-2xl);
  background: var(--surface);
  border: 1px solid var(--line);
  padding: var(--space-4_5) var(--space-3_5) var(--space-2_5);
}
.then__title {
  padding: 0 6px 8px;
}
.then__rel {
  font: 500 var(--text-xs) var(--font-mono);
  color: var(--primary-text);
}
@media (max-width: 759px) {
  .hero-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .hero {
    min-height: 260px;
  }
  .hero__content {
    padding: var(--space-5);
  }
  .hero__name {
    font-size: var(--text-hero-mobile);
  }
}
</style>
