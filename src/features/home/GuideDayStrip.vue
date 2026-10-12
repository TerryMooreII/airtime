<script setup lang="ts">
import { AEmptyState } from '@/design-system'
import { useFollow } from '@/composables/useFollow'
import type { UpcomingEpisode } from '@/types/domain'

import GuideDayHeader from './GuideDayHeader.vue'
import GuideEpisodeRow from './GuideEpisodeRow.vue'
import type { CalendarDay } from './useGuideSchedule'

/** Phone calendar: a strip of days and the selected day's episodes. */
defineProps<{
  days: CalendarDay[]
  selected: CalendarDay | null
  tz: string
  now: number
  canFollow: boolean
  isFollowed: (e: UpcomingEpisode) => boolean
}>()
const emit = defineEmits<{ select: [key: string] }>()
const follow = useFollow()
</script>

<template>
  <div class="strip-view">
    <div class="strip">
      <button
        v-for="d in days"
        :key="d.key"
        type="button"
        class="strip__day"
        :class="{ 'strip__day--on': d.key === selected?.key }"
        @click="emit('select', d.key)"
      >
        <span class="strip__dow">{{ d.dow }}</span>
        <span class="strip__num">{{ d.num }}</span>
        <span class="strip__dot" :class="{ 'strip__dot--on': d.items.length }" />
      </button>
    </div>
    <div v-if="selected" class="day">
      <GuideDayHeader
        :label="selected.isToday ? 'Today' : selected.dow"
        :sub="`${selected.monthLabel} ${selected.num}`"
        :count="selected.items.length"
      />
      <GuideEpisodeRow
        v-for="e in selected.items"
        :key="e.episode_id"
        :episode="e"
        :tz="tz"
        :now="now"
        :badges="false"
        :countdown="false"
        :can-follow="canFollow"
        :following="isFollowed(e)"
        :follow-pending="follow.pending(e.show_id)"
        @toggle-follow="follow.toggle(e.show_id, undefined, e.show_name)"
      />
      <AEmptyState v-if="!selected.items.length" title="Nothing new on this day" compact />
    </div>
  </div>
</template>

<style scoped>
.strip-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.day {
  display: flex;
  flex-direction: column;
}
.strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
}
.strip__day {
  border: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 0;
  min-height: 60px;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--fg);
}
.strip__day--on {
  background: var(--primary);
  color: var(--on-primary);
}
.strip__dow {
  font: 600 var(--text-2xs) var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.strip__num {
  font-size: var(--text-lg);
  font-weight: 700;
}
.strip__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: transparent;
}
.strip__dot--on {
  background: var(--primary);
}
.strip__day--on .strip__dot--on {
  background: var(--on-primary);
}
</style>
