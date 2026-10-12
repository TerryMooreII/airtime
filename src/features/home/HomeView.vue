<script setup lang="ts">
import { AAlert, AButton, AChoiceGroup, AEmptyState, AHeader, ASkeleton } from '@/design-system'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useFollow } from '@/composables/useFollow'

import GuideCalendar from './GuideCalendar.vue'
import GuideDayHeader from './GuideDayHeader.vue'
import GuideDayStrip from './GuideDayStrip.vue'
import GuideEpisodeRow from './GuideEpisodeRow.vue'
import GuideHero from './GuideHero.vue'
import { useGuideSchedule } from './useGuideSchedule'

const { isMobile } = useBreakpoint()
const follow = useFollow()
const guide = useGuideSchedule()
const {
  scope,
  range,
  layout,
  selectedDay,
  now,
  tz,
  loading,
  error,
  load,
  hero,
  then,
  groups,
  calendarDays,
  calendarWeeks,
  selectedCalendarDay,
  subtitle,
  isFollowed,
  hasLibrary,
} = guide
</script>

<template>
  <div class="page guide">
    <AHeader title="Your week on TV" :subtitle="subtitle">
      <AChoiceGroup
        v-model="range"
        variant="segmented"
        :options="[
          { value: 7, label: '7 days' },
          { value: 14, label: '14 days' },
          { value: 30, label: '30 days' },
        ]"
        aria-label="Range"
      />
    </AHeader>

    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>

    <div v-if="loading" class="guide__skeleton">
      <ASkeleton height="340px" radius="20px" />
      <ASkeleton height="64px" />
      <ASkeleton height="64px" />
    </div>

    <template v-else>
      <GuideHero v-if="hero && scope === 'mine'" :hero="hero" :then="then" :tz="tz" :now="now" />

      <!-- Scope and layout sit right above the list they change. -->
      <div class="guide__tools">
        <AChoiceGroup
          v-model="scope"
          variant="segmented"
          :options="[
            { value: 'mine', label: 'My shows' },
            { value: 'everything', label: 'Everything' },
          ]"
          aria-label="Scope"
        />
        <AChoiceGroup
          v-model="layout"
          variant="segmented"
          :options="[
            { value: 'agenda', label: 'Agenda' },
            { value: 'calendar', label: 'Calendar' },
          ]"
          aria-label="Layout"
        />
      </div>

      <div v-if="groups.length && layout === 'agenda'" class="agenda">
        <section v-for="g in groups" :key="g.key" class="agenda__day">
          <GuideDayHeader :label="g.label" :sub="g.sub" :count="g.items.length" />
          <GuideEpisodeRow
            v-for="e in g.items"
            :key="e.episode_id"
            :episode="e"
            :tz="tz"
            :now="now"
            :can-follow="scope === 'everything'"
            :following="isFollowed(e)"
            :follow-pending="follow.pending(e.show_id)"
            @toggle-follow="follow.toggle(e.show_id, undefined, e.show_name)"
          />
        </section>
      </div>

      <template v-else-if="groups.length && layout === 'calendar'">
        <GuideCalendar
          v-if="!isMobile"
          :weeks="calendarWeeks"
          :tz="tz"
          :now="now"
          :can-follow="scope === 'everything'"
          :is-followed="isFollowed"
        />
        <GuideDayStrip
          v-else
          :days="calendarDays"
          :selected="selectedCalendarDay"
          :tz="tz"
          :now="now"
          :can-follow="scope === 'everything'"
          :is-followed="isFollowed"
          @select="selectedDay = $event"
        />
      </template>

      <AEmptyState
        v-else
        title="Nothing scheduled yet"
        :description="
          hasLibrary
            ? 'None of the shows you follow have upcoming episodes in this range.'
            : 'Follow a few shows and your guide fills itself in.'
        "
      >
        <AButton :to="{ name: 'search' }" icon="search">Find shows</AButton>
      </AEmptyState>
    </template>
  </div>
</template>

<style scoped>
.guide__tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: -8px;
}
.guide__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.agenda {
  display: flex;
  flex-direction: column;
  gap: var(--space-4_5);
}
.agenda__day {
  display: flex;
  flex-direction: column;
}
</style>
