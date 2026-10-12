import { computed, onMounted, ref, watch } from 'vue'

import { useAsync } from '@/composables/useAsync'
import { useNow } from '@/composables/useNow'
import { useQueryParam } from '@/composables/useQueryParam'
import { endsAt, groupByDay } from '@/lib/episodes'
import { dayKey, plural } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useUpcomingStore } from '@/stores/upcoming'
import type { UpcomingEpisode } from '@/types/domain'

export type GuideScope = 'mine' | 'everything'
export type GuideLayout = 'agenda' | 'calendar'
export type GuideRange = 7 | 14 | 30

/** One calendar day in the range, including empty days. */
export interface CalendarDay {
  key: string
  dow: string
  num: number
  monthLabel: string
  isToday: boolean
  items: UpcomingEpisode[]
}

/**
 * The Guide's state: scope, range and layout live in the URL (and localStorage) so a refresh
 * or the back button restores them; the episode feed comes from the shared upcoming store.
 */
export function useGuideSchedule() {
  const auth = useAuthStore()
  const library = useLibraryStore()
  const upcomingStore = useUpcomingStore()

  const scope = useQueryParam<GuideScope>('scope', {
    defaultValue: 'mine',
    parse: (r) => (r === 'mine' || r === 'everything' ? r : undefined),
    remember: 'airtime:guide-scope',
  })
  const range = useQueryParam<GuideRange>('days', {
    defaultValue: 14,
    parse: (r) => ([7, 14, 30] as const).find((n) => String(n) === r),
  })
  const layout = useQueryParam<GuideLayout>('layout', {
    defaultValue: 'agenda',
    parse: (r) => (r === 'agenda' || r === 'calendar' ? r : undefined),
    remember: 'airtime:guide-layout',
  })
  const selectedDay = ref<string | null>(null)
  const now = useNow(30_000)
  const tz = computed(() => auth.timezone)
  const feed = computed<'mine' | 'everything'>(() =>
    scope.value === 'everything' ? 'everything' : 'mine',
  )

  const {
    loading,
    error,
    run: load,
  } = useAsync(() => upcomingStore.load(feed.value, range.value), { initialLoading: true })
  watch([scope, range], () => void load())
  onMounted(load)

  const episodes = computed(() => upcomingStore.items(feed.value, range.value))
  const upcoming = computed(() => episodes.value.filter((e) => endsAt(e) >= now.value))
  const hero = computed(() => upcoming.value[0] ?? null)
  const then = computed(() => upcoming.value.slice(1, 5))
  const groups = computed(() => groupByDay(episodes.value, tz.value))

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
    if (scope.value === 'everything')
      return `${plural(upcoming.value.length, 'episode')} from ${plural(shows, 'show')} airing · next ${range.value} days`
    return `${plural(upcoming.value.length, 'new episode')} from ${plural(shows, 'show')} you follow · next ${range.value} days`
  })

  /** In "Everything" the feed says whether a show is followed; in "My shows" every row is. */
  function isFollowed(e: UpcomingEpisode): boolean {
    return scope.value === 'mine' ? true : (e.followed ?? library.byShowId.has(e.show_id))
  }

  return {
    scope,
    range,
    layout,
    selectedDay,
    now,
    tz,
    loading,
    error,
    load,
    episodes,
    upcoming,
    hero,
    then,
    groups,
    calendarDays,
    calendarWeeks,
    selectedCalendarDay,
    subtitle,
    isFollowed,
    hasLibrary: computed(() => library.entries.length > 0),
  }
}
