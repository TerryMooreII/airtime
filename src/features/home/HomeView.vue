<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import { fetchUpcomingEpisodes } from '@/lib/api/episodes'
import { dayKey, episodeCode, formatAirTime, formatRuntime, relativeDayLabel } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import type { UpcomingEpisode } from '@/types/domain'

const auth = useAuthStore()
const library = useLibraryStore()

const episodes = ref<UpcomingEpisode[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const range = ref<7 | 14 | 30>(14)
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

      <div v-if="groups.length" class="agenda">
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
