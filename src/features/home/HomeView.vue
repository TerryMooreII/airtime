<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import {
  AAlert,
  AButton,
  AEmptyState,
  APageHeader,
  APoster,
  ASegmented,
  ASkeleton,
} from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { fetchUpcomingEpisodes } from '@/lib/api/episodes'
import { dayKey, episodeCode, formatAirTime, formatRuntime, relativeDayLabel } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import type { UpcomingEpisode } from '@/types/domain'

const auth = useAuthStore()
const library = useLibraryStore()
const { isMobile } = useBreakpoint()

const episodes = ref<UpcomingEpisode[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const range = ref<7 | 14 | 30>(14)
type Layout = 'agenda' | 'calendar'
const LAYOUT_KEY = 'airtime:guide-layout'
const layout = ref<Layout>(readLayout())
function readLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'calendar' ? 'calendar' : 'agenda'
  } catch {
    return 'agenda'
  }
}
watch(layout, (v) => {
  try {
    localStorage.setItem(LAYOUT_KEY, v)
  } catch {
    /* ignore */
  }
})
const selectedDay = ref<string | null>(null)
const now = ref(Date.now())
setInterval(() => (now.value = Date.now()), 30_000)

const tz = computed(() => auth.timezone)

async function load() {
  loading.value = true
  error.value = null
  try {
    episodes.value = await fetchUpcomingEpisodes(range.value, 300)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

function endOf(e: UpcomingEpisode): number {
  return new Date(e.airstamp).getTime() + (e.runtime ?? 30) * 60_000
}
function rel(e: UpcomingEpisode): string {
  const t = new Date(e.airstamp).getTime()
  if (endOf(e) < now.value) return 'Aired'
  const m = Math.round((t - now.value) / 60_000)
  if (m <= 0) return 'On now'
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `in ${h}h ${String(m % 60).padStart(2, '0')}m`
  return `in ${Math.floor(h / 24)}d ${h % 24}h`
}

const upcoming = computed(() => episodes.value.filter((e) => endOf(e) >= now.value))
const hero = computed(() => upcoming.value[0] ?? null)
const then = computed(() => upcoming.value.slice(1, 5))

interface DayGroup {
  key: string
  label: string
  sub: string
  items: UpcomingEpisode[]
}
const groups = computed<DayGroup[]>(() => {
  const map = new Map<string, DayGroup>()
  for (const e of episodes.value) {
    const key = dayKey(e.airstamp, tz.value)
    let g = map.get(key)
    if (!g) {
      g = {
        key,
        label: relativeDayLabel(e.airstamp, tz.value),
        sub: new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          timeZone: tz.value,
        }).format(new Date(e.airstamp)),
        items: [],
      }
      map.set(key, g)
    }
    g.items.push(e)
  }
  return [...map.values()]
})

/** One entry per calendar day in the range, including empty days, for the calendar layout. */
interface CalendarDay {
  key: string
  dow: string
  num: number
  monthLabel: string
  isToday: boolean
  items: UpcomingEpisode[]
}
const calendarDays = computed<CalendarDay[]>(() => {
  const byKey = new Map<string, UpcomingEpisode[]>()
  for (const e of episodes.value) {
    const key = dayKey(e.airstamp, tz.value)
    byKey.set(key, [...(byKey.get(key) ?? []), e])
  }
  const todayKey = dayKey(new Date().toISOString(), tz.value)
  const out: CalendarDay[] = []
  for (let d = 0; d < range.value; d++) {
    const date = new Date(Date.now() + d * 86_400_000)
    const key = dayKey(date.toISOString(), tz.value)
    const parts = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: tz.value,
    }).formatToParts(date)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    out.push({
      key,
      dow: get('weekday'),
      num: Number(get('day')),
      monthLabel: get('month'),
      isToday: key === todayKey,
      items: byKey.get(key) ?? [],
    })
  }
  return out
})
const calendarWeeks = computed(() => {
  const weeks: CalendarDay[][] = []
  for (let i = 0; i < calendarDays.value.length; i += 7)
    weeks.push(calendarDays.value.slice(i, i + 7))
  return weeks
})
const selectedCalendarDay = computed(
  () =>
    calendarDays.value.find((d) => d.key === selectedDay.value) ?? calendarDays.value[0] ?? null,
)

const subtitle = computed(() => {
  if (loading.value) return 'Loading your schedule…'
  const shows = new Set(upcoming.value.map((e) => e.show_id)).size
  return `${upcoming.value.length} new episode${upcoming.value.length === 1 ? '' : 's'} from ${shows} show${shows === 1 ? '' : 's'} you follow · next ${range.value} days`
})
</script>

<template>
  <div class="guide">
    <APageHeader title="Your week on TV" :subtitle="subtitle">
      <ASegmented
        v-model="range"
        :options="[
          { value: 7, label: '7 days' },
          { value: 14, label: '14 days' },
          { value: 30, label: '30 days' },
        ]"
        aria-label="Range"
        @update:model-value="load"
      />
      <ASegmented
        v-model="layout"
        :options="[
          { value: 'agenda', label: 'Agenda' },
          { value: 'calendar', label: 'Calendar' },
        ]"
        aria-label="Layout"
      />
    </APageHeader>

    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>

    <div v-if="loading" class="guide__skeleton">
      <ASkeleton height="340px" radius="20px" />
      <ASkeleton height="64px" />
      <ASkeleton height="64px" />
    </div>

    <template v-else>
      <div v-if="hero" class="hero-grid">
        <RouterLink :to="{ name: 'show', params: { id: hero.show_id } }" class="hero">
          <img v-if="hero.show_image" :src="hero.show_image" alt="" class="hero__bg" />
          <div class="hero__shade" />
          <div class="hero__content">
            <span class="hero__badge">Up next · {{ rel(hero) }}</span>
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
          <RouterLink
            v-for="e in then"
            :key="e.episode_id"
            :to="{ name: 'show', params: { id: e.show_id } }"
            class="then__item"
          >
            <APoster :src="e.show_image" radius="sm" class="then__img" />
            <span class="then__text">
              <span class="then__name truncate">{{ e.show_name }}</span>
              <span class="then__when"
                >{{ relativeDayLabel(e.airstamp, tz) }} · {{ formatAirTime(e.airstamp, tz) }}</span
              >
              <span class="then__rel">{{ rel(e) }}</span>
            </span>
          </RouterLink>
          <AEmptyState v-if="!then.length" title="Nothing else yet" compact :dashed="false" />
        </div>
      </div>

      <div v-if="groups.length && layout === 'agenda'" class="agenda">
        <section v-for="g in groups" :key="g.key" class="agenda__day">
          <div class="agenda__head">
            <span class="agenda__label">{{ g.label }}</span>
            <span class="agenda__sub">{{ g.sub }}</span>
            <span class="agenda__count"
              >{{ g.items.length }} ep{{ g.items.length === 1 ? '' : 's' }}</span
            >
          </div>
          <RouterLink
            v-for="e in g.items"
            :key="e.episode_id"
            :to="{ name: 'show', params: { id: e.show_id } }"
            class="row"
            :class="{ 'row--past': endOf(e) < now }"
          >
            <span class="row__time t-mono">{{ formatAirTime(e.airstamp, tz) }}</span>
            <APoster :src="e.show_image" radius="sm" />
            <span class="row__text">
              <span class="row__title">
                <span class="row__name truncate">{{ e.show_name }}</span>
                <span
                  v-if="endOf(e) >= now && new Date(e.airstamp).getTime() <= now"
                  class="row__badge row__badge--live"
                  >On now</span
                >
                <span v-else-if="e.number === 1" class="row__badge">{{
                  e.season === 1 ? 'Series premiere' : 'Season premiere'
                }}</span>
              </span>
              <span class="row__ep truncate"
                ><span class="t-mono row__code">{{ episodeCode(e.season, e.number) }}</span> ·
                {{ e.episode_name ?? 'TBA' }}</span
              >
            </span>
            <span class="row__rel t-mono">{{ rel(e) }}</span>
          </RouterLink>
        </section>
      </div>

      <template v-else-if="groups.length && layout === 'calendar'">
        <!-- Desktop: week rows of seven day columns -->
        <div v-if="!isMobile" class="cal">
          <div v-for="(week, wi) in calendarWeeks" :key="wi" class="cal__week">
            <div v-for="d in week" :key="d.key" class="cal__col">
              <div class="cal__head" :class="{ 'cal__head--today': d.isToday }">
                <span class="cal__dow">{{ d.dow }}</span>
                <span class="cal__num">{{ d.num }}</span>
              </div>
              <RouterLink
                v-for="e in d.items.slice(0, 8)"
                :key="e.episode_id"
                :to="{ name: 'show', params: { id: e.show_id } }"
                class="cal__item"
                :class="{ 'cal__item--past': endOf(e) < now }"
              >
                <APoster :src="e.show_image" radius="sm" class="cal__img" />
                <span class="cal__text">
                  <span class="cal__time">{{ formatAirTime(e.airstamp, tz) }}</span>
                  <span class="cal__name">{{ e.show_name }}</span>
                  <span class="cal__code">{{ episodeCode(e.season, e.number) }}</span>
                </span>
              </RouterLink>
              <span v-if="d.items.length > 8" class="cal__more"
                >+{{ d.items.length - 8 }} more</span
              >
              <div v-if="!d.items.length" class="cal__empty">Nothing new</div>
            </div>
          </div>
        </div>

        <!-- Mobile: day strip + that day's list -->
        <div v-else class="strip-view">
          <div class="strip">
            <button
              v-for="d in calendarDays"
              :key="d.key"
              type="button"
              class="strip__day"
              :class="{ 'strip__day--on': d.key === selectedCalendarDay?.key }"
              @click="selectedDay = d.key"
            >
              <span class="strip__dow">{{ d.dow }}</span>
              <span class="strip__num">{{ d.num }}</span>
              <span class="strip__dot" :class="{ 'strip__dot--on': d.items.length }" />
            </button>
          </div>
          <div v-if="selectedCalendarDay" class="agenda__day">
            <div class="agenda__head">
              <span class="agenda__label">{{
                selectedCalendarDay.isToday ? 'Today' : selectedCalendarDay.dow
              }}</span>
              <span class="agenda__sub"
                >{{ selectedCalendarDay.monthLabel }} {{ selectedCalendarDay.num }}</span
              >
              <span class="agenda__count"
                >{{ selectedCalendarDay.items.length }} ep{{
                  selectedCalendarDay.items.length === 1 ? '' : 's'
                }}</span
              >
            </div>
            <RouterLink
              v-for="e in selectedCalendarDay.items"
              :key="e.episode_id"
              :to="{ name: 'show', params: { id: e.show_id } }"
              class="row"
              :class="{ 'row--past': endOf(e) < now }"
            >
              <span class="row__time t-mono">{{ formatAirTime(e.airstamp, tz) }}</span>
              <APoster :src="e.show_image" radius="sm" />
              <span class="row__text">
                <span class="row__title"
                  ><span class="row__name truncate">{{ e.show_name }}</span></span
                >
                <span class="row__ep truncate"
                  ><span class="t-mono row__code">{{ episodeCode(e.season, e.number) }}</span> ·
                  {{ e.episode_name ?? 'TBA' }}</span
                >
              </span>
            </RouterLink>
            <AEmptyState
              v-if="!selectedCalendarDay.items.length"
              title="Nothing new on this day"
              compact
            />
          </div>
        </div>
      </template>

      <AEmptyState
        v-else
        title="Nothing scheduled yet"
        :description="
          library.entries.length
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
.guide {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.guide__skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 16px;
}
.hero {
  position: relative;
  min-height: 340px;
  border-radius: var(--radius-2xl);
  overflow: hidden;
  background: #111;
  display: flex;
  color: #fff;
}
.hero__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 600ms var(--ease);
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
  padding: 32px;
  gap: 8px;
}
.hero__badge {
  align-self: flex-start;
  font: 600 11px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--primary);
  color: var(--on-primary);
  padding: 5px 9px;
  border-radius: 6px;
}
.hero__name {
  font-size: var(--text-hero);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1;
  text-wrap: balance;
}
.hero__ep {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.88);
}
.hero__code {
  font-size: 13px;
}
.hero__when {
  font: 500 13px var(--font-mono);
  color: rgba(255, 255, 255, 0.75);
}
.then {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-2xl);
  background: var(--surface);
  border: 1px solid var(--line);
  padding: 18px 14px 10px;
}
.then__title {
  padding: 0 6px 8px;
}
.then__item {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 8px 6px;
  border-radius: var(--radius-md);
  color: var(--fg);
}
.then__item:hover {
  background: var(--hover);
}
.then__text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.then__name {
  font-size: 14.5px;
  font-weight: 600;
}
.then__when {
  font: 500 12px var(--font-mono);
  color: var(--muted);
}
.then__rel {
  font: 500 12px var(--font-mono);
  color: var(--primary-text);
}
.agenda {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.agenda__day {
  display: flex;
  flex-direction: column;
}
.agenda__head {
  position: sticky;
  top: 67px;
  z-index: var(--z-sticky);
  background: var(--bg);
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 12px 0 10px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 6px;
}
.agenda__label {
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.agenda__sub,
.agenda__count {
  font: 500 13px var(--font-mono);
  color: var(--muted);
}
.agenda__count {
  margin-left: auto;
  font-size: 12px;
}
.row {
  display: grid;
  grid-template-columns: 76px 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 10px 8px;
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
  font-size: 13.5px;
}
.row__text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.row__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.row__name {
  font-weight: 600;
  font-size: 16px;
}
.row__badge {
  flex: none;
  font: 600 10px var(--font-mono);
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
  font-size: 14px;
  color: var(--muted);
}
.row__code {
  font-size: 12.5px;
}
.row__rel {
  font-size: 12.5px;
  color: var(--primary-text);
  white-space: nowrap;
}
.cal {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cal__week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  align-items: start;
}
.cal__col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.cal__head {
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  background: var(--surface2);
  color: var(--fg);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
}
.cal__head--today {
  background: var(--primary);
  color: var(--on-primary);
}
.cal__dow {
  font: 600 11px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.cal__num {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.cal__item {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 8px;
  padding: 8px;
  border-radius: var(--radius-md);
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--fg);
  transition: border-color var(--dur-fast);
}
.cal__item:hover {
  border-color: var(--line2);
}
.cal__item--past {
  opacity: 0.5;
}
.cal__img {
  width: 30px;
}
.cal__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.cal__time {
  font: 600 11.5px var(--font-mono);
  color: var(--primary-text);
}
.cal__name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cal__code {
  font: 400 11.5px var(--font-mono);
  color: var(--muted);
}
.cal__more {
  font: 500 11.5px var(--font-mono);
  color: var(--muted);
  padding: 0 4px;
}
.cal__empty {
  border: 1px dashed var(--line2);
  border-radius: var(--radius-md);
  padding: 18px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}
.strip-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
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
  font: 600 10.5px var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.strip__num {
  font-size: 18px;
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
@media (max-width: 759px) {
  .hero-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .hero {
    min-height: 260px;
  }
  .hero__content {
    padding: 20px;
  }
  .hero__name {
    font-size: var(--text-hero-mobile);
  }
  .agenda__head {
    top: 65px;
  }
  .row {
    grid-template-columns: 56px 38px minmax(0, 1fr);
  }
  .row__rel {
    display: none;
  }
}
</style>
