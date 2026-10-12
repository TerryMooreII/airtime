import { computed, reactive, ref, type Ref } from 'vue'

import { fetchShowEpisodes } from '@/lib/api/episodes'
import { hasAired, isFuture as episodeIsFuture } from '@/lib/episodes'
import { formatPlainDate, formatRuntime, joinMeta } from '@/lib/format'
import { useUiStore } from '@/stores/ui'
import { useWatchedStore } from '@/stores/watched'
import type { Episode } from '@/types/domain'

/**
 * A show's episode list, the selected season and the watched bookkeeping around it.
 * Returned as a reactive object so a child component can take the whole thing as one prop.
 */
export function useShowEpisodes(showId: Ref<number>, now: Ref<number>) {
  const watched = useWatchedStore()
  const ui = useUiStore()

  const episodes = ref<Episode[]>([])
  const ratings = ref(new Map<number, number>())
  const season = ref<number | null>(null)

  const seasons = computed(() =>
    [...new Set(episodes.value.map((e) => e.season))].sort((a, b) => a - b),
  )
  const seasonOptions = computed(() =>
    seasons.value.map((n) => ({ value: n, label: n === 0 ? 'Specials' : `Season ${n}` })),
  )
  const seasonEpisodes = computed(() => episodes.value.filter((e) => e.season === season.value))
  /** The next episode to air, or one that started in the last half hour. */
  const nextEpisode = computed(() =>
    episodes.value.find(
      (e) => e.airstamp && new Date(e.airstamp).getTime() > now.value - 30 * 60_000,
    ),
  )

  function isFuture(e: Episode): boolean {
    return !!e.airstamp && episodeIsFuture(e, now.value)
  }
  function isWatched(e: Episode): boolean {
    return watched.isWatched(e.id)
  }
  function meta(e: Episode): string {
    const r = ratings.value.get(e.id)
    return joinMeta(
      e.airdate ? formatPlainDate(e.airdate) : 'TBA',
      formatRuntime(e.runtime),
      r && `★ ${r}`,
    )
  }

  /** Episodes and watched ids in parallel; keeps the chosen season when it still exists. */
  async function load(): Promise<void> {
    const [list] = await Promise.all([
      fetchShowEpisodes(showId.value),
      watched.loadForShow(showId.value).catch(() => undefined),
    ])
    episodes.value = list.episodes
    ratings.value = list.ratings
    if (season.value === null || !seasons.value.includes(season.value)) {
      const aired = episodes.value.filter((e) => e.airstamp && hasAired(e, now.value))
      season.value = (aired[aired.length - 1] ?? episodes.value[0])?.season ?? null
    }
  }
  function reset(): void {
    season.value = null
  }
  function setSeason(n: number): void {
    season.value = n
  }

  const airedSeasonIds = computed(() =>
    seasonEpisodes.value.filter((e) => !isFuture(e)).map((e) => e.id),
  )
  const seasonWatched = computed(
    () => airedSeasonIds.value.filter((id) => watched.isWatched(id)).length,
  )
  const allSeasonWatched = computed(
    () => airedSeasonIds.value.length > 0 && seasonWatched.value === airedSeasonIds.value.length,
  )
  const overallAired = computed(() => episodes.value.filter((e) => !isFuture(e)).length)
  const overallWatched = computed(
    () => episodes.value.filter((e) => !isFuture(e) && watched.isWatched(e.id)).length,
  )

  function toggleWatched(e: Episode): void {
    if (isFuture(e)) return
    void ui.attempt(() => watched.toggle(e.id))
  }
  function toggleSeason(): void {
    if (season.value === null) return
    const markWatched = !allSeasonWatched.value
    void ui.attempt(
      () => watched.setSeason(showId.value, season.value!, airedSeasonIds.value, markWatched),
      markWatched ? 'Season marked watched' : 'Season marked unwatched',
    )
  }

  return reactive({
    episodes,
    ratings,
    season,
    seasons,
    seasonOptions,
    seasonEpisodes,
    nextEpisode,
    airedSeasonIds,
    seasonWatched,
    allSeasonWatched,
    overallAired,
    overallWatched,
    isFuture,
    isWatched,
    meta,
    load,
    reset,
    setSeason,
    toggleWatched,
    toggleSeason,
  })
}

export type ShowEpisodesState = ReturnType<typeof useShowEpisodes>
