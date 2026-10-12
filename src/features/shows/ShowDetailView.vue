<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  AAlert,
  ABadge,
  ABrandIcon,
  AButton,
  AChoiceGroup,
  AEmptyState,
  AFollowButton,
  AIcon,
  APersonCard,
  APoster,
  AProgressBar,
  ASkeleton,
  AStarRating,
  type Brand,
  type IconName,
} from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useFollow } from '@/composables/useFollow'
import { useLibraryActions } from '@/composables/useLibraryActions'
import { useNow } from '@/composables/useNow'
import { fetchShowEpisodes } from '@/lib/api/episodes'
import { episodeNumberLabel, hasAired, isFuture as episodeIsFuture } from '@/lib/episodes'
import { fetchShowCast } from '@/lib/tvmaze'
import { externalLink, fetchShowDetail, RATING_PROVIDER_LABELS, refreshShow } from '@/lib/api/shows'
import {
  episodeCode,
  formatPlainDate,
  formatRuntime,
  joinMeta,
  plural,
  relativeDayLabel,
  formatAirTime,
  stripHtml,
  yearOf,
} from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import { useWatchedStore } from '@/stores/watched'
import {
  USER_SHOW_STATUSES,
  type CastMember,
  type Episode,
  type Show,
  type ShowExternalId,
  type ShowRating,
  type UserShowStatus,
} from '@/types/domain'

import EpisodeDrawer from './EpisodeDrawer.vue'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const library = useLibraryStore()
const ui = useUiStore()
const follow = useFollow()
const actions = useLibraryActions()
const watched = useWatchedStore()

const show = ref<Show | null>(null)
const ratings = ref<ShowRating[]>([])
const externalIds = ref<ShowExternalId[]>([])
const episodes = ref<Episode[]>([])
const episodeRatings = ref(new Map<number, number>())
const episodesLoading = ref(false)
const season = ref<number | null>(null)
const openEpisode = ref<Episode | null>(null)

type Tab = 'episodes' | 'cast'
const tab = ref<Tab>('episodes')
const cast = ref<CastMember[] | null>(null)

/** Cast comes live from TVmaze; fetched the first time the tab opens. */
const {
  loading: castLoading,
  error: castError,
  run: loadCast,
} = useAsync(async () => {
  if (!show.value) return
  cast.value = await fetchShowCast(show.value.tvmaze_id)
})
watch(tab, (t) => {
  if (t === 'cast' && cast.value === null) void loadCast()
})
function castRole(c: CastMember): string {
  if (c.self) return 'Themself'
  return c.character ?? ''
}

const showId = computed(() => Number(props.id))
const entry = computed(() => library.entryFor(showId.value))
const tz = computed(() => auth.timezone)
const now = useNow(60_000)

/** Everything is keyed by the route's show id, so the whole page is one round of requests. */
const {
  loading,
  error,
  run: load,
} = useAsync(
  async () => {
    const [detail] = await Promise.all([
      fetchShowDetail(showId.value),
      loadEpisodes(),
      library.load(),
    ])
    if (!detail) {
      show.value = null
      throw new Error('This show is not in the catalog.')
    }
    show.value = detail.show
    ratings.value = detail.ratings
    externalIds.value = detail.externalIds
    const syncedAt = detail.show.episodes_synced_at
    if (!syncedAt || Date.now() - new Date(syncedAt).getTime() > 6 * 3_600_000)
      void refreshEpisodes()
  },
  { initialLoading: true },
)

async function loadEpisodes() {
  const [list] = await Promise.all([
    fetchShowEpisodes(showId.value),
    watched.loadForShow(showId.value).catch(() => undefined),
  ])
  episodes.value = list.episodes
  episodeRatings.value = list.ratings
  if (season.value === null || !seasons.value.includes(season.value)) {
    const aired = episodes.value.filter((e) => e.airstamp && hasAired(e, now.value))
    season.value = (aired[aired.length - 1] ?? episodes.value[0])?.season ?? null
  }
}

/** Pull the complete episode list from TVMaze when it has never been synced or is stale. */
async function refreshEpisodes() {
  if (!show.value || episodesLoading.value) return
  episodesLoading.value = true
  try {
    const res = await refreshShow(show.value.tvmaze_id)
    if (res.refreshed) {
      const [detail] = await Promise.all([fetchShowDetail(showId.value), loadEpisodes()])
      if (detail) show.value = detail.show
    }
  } catch (err) {
    console.warn('refresh-show failed', err)
  } finally {
    episodesLoading.value = false
  }
}

onMounted(load)
watch(showId, () => {
  season.value = null
  tab.value = 'episodes'
  cast.value = null
  void load()
})

const seasons = computed(() =>
  [...new Set(episodes.value.map((e) => e.season))].sort((a, b) => a - b),
)
const seasonOptions = computed(() =>
  seasons.value.map((n) => ({ value: n, label: n === 0 ? 'Specials' : `Season ${n}` })),
)
const seasonEpisodes = computed(() => episodes.value.filter((e) => e.season === season.value))
const nextEpisode = computed(() =>
  episodes.value.find(
    (e) => e.airstamp && new Date(e.airstamp).getTime() > now.value - 30 * 60_000,
  ),
)

const genres = computed(() => show.value?.genres ?? [])
/** Where it airs: the TV network with its country, else the streaming service. */
const channel = computed(() => {
  const s = show.value
  if (!s) return null
  if (s.network)
    return {
      kind: 'network' as const,
      label: [s.network.name, s.network.country_code].filter(Boolean).join(' · '),
    }
  if (s.web_channel) return { kind: 'web_channel' as const, label: s.web_channel.name }
  return null
})
const meta = computed(() => {
  const s = show.value
  if (!s) return ''
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
const tvmazeRating = computed(() => ratings.value.find((r) => r.provider === 'tvmaze'))
const otherRatings = computed(() => ratings.value.filter((r) => r.provider !== 'tvmaze'))
interface ShowLink {
  label: string
  href: string
  icon: IconName
  brand?: Brand
}
const links = computed<ShowLink[]>(() => {
  const out: ShowLink[] = []
  if (show.value?.tvmaze_url)
    out.push({ label: 'TVmaze', href: show.value.tvmaze_url, icon: 'tv', brand: 'tvmaze' })
  for (const x of externalIds.value) {
    const href = externalLink(x.provider, x.external_id)
    if (!href) continue
    out.push({
      label: RATING_PROVIDER_LABELS[x.provider] ?? x.provider,
      href,
      icon: x.provider === 'imdb' ? 'film' : 'database',
      brand: x.provider === 'imdb' ? 'imdb' : x.provider === 'thetvdb' ? 'thetvdb' : undefined,
    })
  }
  if (show.value?.official_site)
    out.push({ label: 'Official site', href: show.value.official_site, icon: 'globe' })
  return out
})

const setRating = (rating: number | null) => show.value && actions.rate(show.value, rating)
const setStatus = (status: UserShowStatus) => show.value && actions.setStatus(show.value, status)
const setNotify = (notify: boolean) => show.value && actions.setNotify(show.value, notify)
function toggleFollow() {
  if (show.value) void follow.toggle(show.value.id, show.value.tvmaze_id, show.value.name)
}
function episodeMeta(e: Episode): string {
  const r = episodeRatings.value.get(e.id)
  return joinMeta(
    e.airdate ? formatPlainDate(e.airdate) : 'TBA',
    formatRuntime(e.runtime),
    r && `★ ${r}`,
  )
}
function openFromDrawer(e: Episode) {
  openEpisode.value = e
  season.value = e.season
}
function isFuture(e: Episode): boolean {
  return !!e.airstamp && episodeIsFuture(e, now.value)
}

// ---------------------------------------------------------------------------
// Watched tracking
// ---------------------------------------------------------------------------
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

function toggleWatched(e: Episode, ev?: Event) {
  ev?.stopPropagation()
  if (isFuture(e)) return
  void ui.attempt(() => watched.toggle(e.id))
}
function toggleSeason() {
  if (!show.value || season.value === null) return
  const { id } = show.value
  const markWatched = !allSeasonWatched.value
  void ui.attempt(
    () => watched.setSeason(id, season.value!, airedSeasonIds.value, markWatched),
    markWatched ? 'Season marked watched' : 'Season marked unwatched',
  )
}
</script>

<template>
  <div class="page show">
    <ABackButton :fallback="{ name: 'library' }" />

    <AAlert v-if="error" variant="error">{{ error }}</AAlert>
    <ASkeleton v-else-if="loading" height="340px" radius="22px" />

    <template v-else-if="show">
      <AMediaHero
        :title="show.name"
        :backdrop="show.image_original ?? show.image_medium"
        :meta="meta"
        size="xl"
        :media-width="210"
      >
        <template #media
          ><APoster :src="show.image_medium" :alt="show.name" radius="lg"
        /></template>
        <template #above>
          <div v-if="genres.length || channel" class="cluster hero__genres">
            <ABadge v-if="channel" variant="soft" :mono="false" class="hero__channel">
              <AIcon :name="channel.kind === 'network' ? 'tv' : 'play'" :size="13" />{{
                channel.label
              }}
            </ABadge>
            <ABadge v-for="g in genres" :key="g" variant="outline" :mono="false">{{ g }}</ABadge>
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
              @update:model-value="setRating"
            />
          </div>
          <AFollowButton
            :following="!!entry"
            :loading="follow.pending(show.id)"
            size="lg"
            @toggle="toggleFollow"
          />
        </div>
        <AChoiceGroup
          variant="pills"
          :model-value="entry?.status ?? ''"
          :options="USER_SHOW_STATUSES"
          aria-label="Watch status"
          class="hero__status"
          @update:model-value="setStatus($event as UserShowStatus)"
        />
      </AMediaHero>

      <section class="about">
        <div class="about__text">
          <span class="t-label">About</span>
          <p class="about__summary">
            {{ stripHtml(show.summary_html) || 'No synopsis available.' }}
          </p>
          <div v-if="links.length" class="about__links">
            <AButton
              v-for="l in links"
              :key="l.href"
              :href="l.href"
              variant="outline"
              size="sm"
              :icon="l.icon"
            >
              <template v-if="l.brand" #icon><ABrandIcon :brand="l.brand" :size="18" /></template>
              {{ l.label }}<AIcon name="external" :size="13" class="about__ext" />
            </AButton>
          </div>
        </div>
        <div class="about__side">
          <div v-if="nextEpisode" class="next">
            <span class="t-kicker"
              >Next episode · {{ relativeDayLabel(nextEpisode.airstamp!, tz) }}</span
            >
            <span class="next__title">{{ nextEpisode.name ?? 'TBA' }}</span>
            <span class="t-meta"
              >{{ episodeCode(nextEpisode.season, nextEpisode.number) }} ·
              {{ formatAirTime(nextEpisode.airstamp, tz) }}</span
            >
          </div>
          <div v-if="entry" class="alerts">
            <div class="stack-tight alerts__text">
              <span class="alerts__title">Episode alerts</span>
              <span class="alerts__desc">{{
                entry.notify ? 'You will be told when new episodes air.' : 'Muted for this show.'
              }}</span>
            </div>
            <AButton
              variant="outline"
              size="sm"
              :icon="entry.notify ? 'bellOff' : 'bell'"
              @click="setNotify(!entry.notify)"
              >{{ entry.notify ? 'Mute' : 'Unmute' }}</AButton
            >
          </div>
        </div>
      </section>

      <AChoiceGroup
        v-model="tab"
        variant="tabs"
        :options="[
          { value: 'episodes', label: 'Episodes', count: episodes.length || undefined },
          { value: 'cast', label: 'Cast', count: cast?.length },
        ]"
        aria-label="Show sections"
      />

      <section v-if="tab === 'episodes'" class="episodes">
        <AHeader
          level="section"
          title="Episodes"
          :subtitle="episodesLoading ? 'Syncing from TVmaze…' : undefined"
        >
          <AButton
            v-if="airedSeasonIds.length"
            variant="outline"
            size="sm"
            :icon="allSeasonWatched ? 'minus' : 'check'"
            @click="toggleSeason"
            >{{ allSeasonWatched ? 'Mark season unwatched' : 'Mark season watched' }}</AButton
          >
          <AButton
            v-if="!episodesLoading"
            variant="ghost"
            size="sm"
            icon="refresh"
            @click="refreshEpisodes"
            >Refresh</AButton
          >
        </AHeader>
        <AChoiceGroup
          v-if="seasons.length > 1"
          variant="pills"
          :model-value="season ?? -1"
          :options="seasonOptions"
          mono
          aria-label="Season"
          @update:model-value="season = Number($event)"
        />
        <div v-if="airedSeasonIds.length" class="episodes__progress">
          <AProgressBar
            :value="seasonWatched"
            :max="airedSeasonIds.length"
            size="md"
            label="Season progress"
          />
          <span class="episodes__progress-label t-mono"
            >{{ seasonWatched }} of {{ airedSeasonIds.length }} watched</span
          >
        </div>
        <span class="episodes__count"
          >{{ plural(seasonEpisodes.length, 'episode')
          }}<template v-if="overallAired">
            · {{ overallWatched }} of {{ overallAired }} aired episodes watched overall</template
          ></span
        >

        <div v-if="!episodes.length && episodesLoading" class="episodes__skeleton">
          <ASkeleton v-for="i in 4" :key="i" height="90px" />
        </div>
        <div v-else-if="seasonEpisodes.length" class="episodes__list">
          <div
            v-for="e in seasonEpisodes"
            :key="e.id"
            role="button"
            tabindex="0"
            class="episode"
            :class="{ 'episode--future': isFuture(e), 'episode--watched': watched.isWatched(e.id) }"
            @click="openEpisode = e"
            @keydown.enter="openEpisode = e"
          >
            <APoster :src="e.image_medium ?? show.image_medium" ratio="still" radius="md" />
            <span class="stack-tight episode__text">
              <span class="episode__title">
                <span class="episode__code t-mono">{{ episodeNumberLabel(e.number) }}</span>
                <span class="truncate">{{ e.name ?? 'TBA' }}</span>
              </span>
              <span class="episode__meta">{{ episodeMeta(e) }}</span>
              <span class="episode__sum clamp-2">{{ stripHtml(e.summary_html) }}</span>
            </span>
            <button
              v-if="!isFuture(e)"
              type="button"
              class="episode__check"
              :class="{ 'episode__check--on': watched.isWatched(e.id) }"
              :aria-label="watched.isWatched(e.id) ? 'Mark unwatched' : 'Mark watched'"
              :aria-pressed="watched.isWatched(e.id)"
              @click="toggleWatched(e, $event)"
            >
              <AIcon name="check" :size="16" :stroke-width="2.6" />
            </button>
            <span v-else class="episode__check episode__check--spacer" aria-hidden="true" />
          </div>
        </div>
        <p v-else class="t-sub">No episodes listed yet.</p>
      </section>

      <section v-else class="cast">
        <AAlert v-if="castError" variant="error" @retry="loadCast">{{ castError }}</AAlert>
        <div v-else-if="castLoading || cast === null" class="cast__grid">
          <div v-for="i in 8" :key="i" class="cast__skeleton">
            <ASkeleton width="76px" height="76px" radius="50%" />
            <ASkeleton width="70%" height="12px" />
            <ASkeleton width="50%" height="10px" />
          </div>
        </div>
        <AEmptyState
          v-else-if="!cast.length"
          title="No cast listed"
          description="TVmaze doesn't have cast information for this show yet."
          compact
        />
        <div v-else class="cast__grid">
          <APersonCard
            v-for="c in cast"
            :key="c.personId"
            :name="c.name"
            :image="c.image"
            :role="castRole(c)"
            :tag="c.voice ? 'voice' : undefined"
            :to="{ name: 'person', params: { id: c.personId } }"
          />
        </div>
        <p class="t-muted cast__credit">Cast data from TVmaze.</p>
      </section>
    </template>

    <EpisodeDrawer
      :episode="openEpisode"
      :episodes="episodes"
      :show-name="show?.name ?? ''"
      :show-image="show?.image_medium ?? null"
      :timezone="tz"
      :rating="openEpisode ? episodeRatings.get(openEpisode.id) : undefined"
      :watched="openEpisode ? watched.isWatched(openEpisode.id) : false"
      :can-watch="openEpisode ? !isFuture(openEpisode) : false"
      @toggle-watched="openEpisode && toggleWatched(openEpisode)"
      @close="openEpisode = null"
      @navigate="openFromDrawer"
    />
  </div>
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
.about {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: var(--space-6);
  align-items: start;
}
.about__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
}
.about__summary {
  font-size: var(--text-md);
  line-height: 1.6;
  text-wrap: pretty;
  max-width: 68ch;
}
.about__links {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-1_5);
}
.about__ext {
  color: var(--muted);
  margin-left: -2px;
}
.about__side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.next {
  border-radius: var(--radius-xl);
  background: var(--primary-soft);
  padding: var(--space-4_5);
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}
.next__title {
  font-size: var(--text-lg);
  font-weight: 600;
}
.alerts {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3_5) var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid var(--line);
  background: var(--surface);
}
.alerts__title {
  font-size: var(--text-base);
  font-weight: 600;
}
.alerts__desc {
  font-size: var(--text-xs);
  color: var(--muted);
}
.episodes {
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
}

.episodes__count {
  font-size: var(--text-sm);
  color: var(--muted);
  margin-top: -6px;
}
.episodes__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.episodes__list {
  display: flex;
  flex-direction: column;
}

.episodes__progress {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.episodes__progress-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--muted);
  white-space: nowrap;
}
.episode__check {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid var(--line2);
  background: transparent;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  transition:
    background var(--dur-fast),
    border-color var(--dur-fast),
    color var(--dur-fast);
}
.episode__check:hover {
  border-color: var(--primary);
  color: var(--primary-text);
}
.episode__check--on {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}
.episode__check--spacer {
  border-color: transparent;
}
.episode--watched .episode__title {
  color: var(--muted);
}
.episode {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) 36px;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-2_5) var(--space-2);
  margin: 0 -8px;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--fg);
  text-align: left;
  cursor: pointer;
}
.episode:hover {
  background: var(--hover);
}
.episode--future {
  opacity: 0.55;
}
.episode__title {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
  font-size: var(--text-md);
  font-weight: 600;
}
.episode__code {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--primary-text);
  flex: none;
}
.episode__meta {
  font: 500 var(--text-xs) var(--font-mono);
  color: var(--muted);
}
.episode__sum {
  font-size: var(--text-sm);
  color: var(--muted);
  line-height: 1.45;
}
.cast {
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
}
.cast__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: var(--space-2_5) var(--space-1_5);
}
.cast__skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-1);
}
.cast__credit {
  font-size: var(--text-xs);
}
@media (max-width: 759px) {
  .about {
    grid-template-columns: minmax(0, 1fr);
  }
  .episode {
    grid-template-columns: 104px minmax(0, 1fr) 36px;
  }
  .episode__sum {
    display: none;
  }
}
</style>
