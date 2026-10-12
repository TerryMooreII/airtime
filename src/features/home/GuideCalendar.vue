<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { AFollowButton, APoster } from '@/design-system'
import { useFollow } from '@/composables/useFollow'
import { endsAt } from '@/lib/episodes'
import { episodeCode, formatAirTime } from '@/lib/format'
import type { UpcomingEpisode } from '@/types/domain'

import type { CalendarDay } from './useGuideSchedule'

/** Desktop calendar: week rows of seven day columns, up to eight episodes per day. */
defineProps<{
  weeks: CalendarDay[][]
  tz: string
  now: number
  canFollow: boolean
  isFollowed: (e: UpcomingEpisode) => boolean
}>()
const follow = useFollow()
const MAX_PER_DAY = 8
</script>

<template>
  <div class="cal">
    <div v-for="(week, wi) in weeks" :key="wi" class="cal__week">
      <div v-for="d in week" :key="d.key" class="cal__col">
        <div class="cal__head" :class="{ 'cal__head--today': d.isToday }">
          <span class="cal__dow">{{ d.dow }}</span>
          <span class="cal__num">{{ d.num }}</span>
        </div>
        <RouterLink
          v-for="e in d.items.slice(0, MAX_PER_DAY)"
          :key="e.episode_id"
          :to="{ name: 'show', params: { id: e.show_id } }"
          class="cal__item"
          :class="{ 'cal__item--past': endsAt(e) < now }"
        >
          <APoster :src="e.show_image" radius="sm" class="cal__img" />
          <AFollowButton
            v-if="canFollow"
            :following="isFollowed(e)"
            :loading="follow.pending(e.show_id)"
            appearance="chip"
            small
            class="cal__follow"
            @toggle="follow.toggle(e.show_id, undefined, e.show_name)"
          />
          <span class="stack-tight">
            <span class="cal__time">{{ formatAirTime(e.airstamp, tz) }}</span>
            <span class="cal__name clamp-2">{{ e.show_name }}</span>
            <span class="cal__code">{{ episodeCode(e.season, e.number) }}</span>
          </span>
        </RouterLink>
        <span v-if="d.items.length > MAX_PER_DAY" class="cal__more"
          >+{{ d.items.length - MAX_PER_DAY }} more</span
        >
        <div v-if="!d.items.length" class="cal__empty">Nothing new</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
}
.cal__week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-2);
  align-items: start;
}
.cal__col {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
  min-width: 0;
}
.cal__head {
  padding: var(--space-2_5) var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--surface2);
  color: var(--fg);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1);
}
.cal__head--today {
  background: var(--primary);
  color: var(--on-primary);
}
.cal__dow {
  font: 600 var(--text-2xs) var(--font-mono);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}
.cal__num {
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.cal__item {
  position: relative;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--fg);
  transition: border-color var(--dur-fast) var(--ease);
}
.cal__item:hover {
  border-color: var(--line2);
}
.cal__item--past {
  opacity: 0.5;
}
.cal__follow {
  --chip-offset: 6px;
}
.cal__img {
  width: 30px;
}
.cal__time {
  font: 600 var(--text-2xs) var(--font-mono);
  color: var(--primary-text);
}
.cal__name {
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1.25;
}
.cal__code {
  font: 400 var(--text-2xs) var(--font-mono);
  color: var(--muted);
}
.cal__more {
  font: 500 var(--text-2xs) var(--font-mono);
  color: var(--muted);
  padding: 0 4px;
}
.cal__empty {
  border: 1px dashed var(--line2);
  border-radius: var(--radius-md);
  padding: var(--space-4_5) var(--space-2);
  text-align: center;
  font-size: var(--text-xs);
  color: var(--muted);
}
</style>
