<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  AAlert,
  ABrandIcon,
  ABadge,
  AButton,
  AFollowButton,
  APills,
  APoster,
  ASkeleton,
  AStarRating,
  AIcon,
  type Brand,
  type IconName,
} from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { useFollow } from '@/composables/useFollow'
import { fetchEpisodeRatings, fetchEpisodesForShow } from '@/lib/api/episodes'
import {
  externalLink,
  fetchShow,
  fetchShowExternalIds,
  fetchShowRatings,
  RATING_PROVIDER_LABELS,
} from '@/lib/api/shows'
import {
  episodeCode,
  formatPlainDate,
  formatRuntime,
  relativeDayLabel,
  formatAirTime,
  stripHtml,
  yearOf,
} from '@/lib/format'
import { invokeFunction } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import {
  USER_SHOW_STATUSES,
  type Episode,
  type Show,
  type ShowExternalId,
  type ShowRating,
  type UserShowStatus,
} from '@/types/domain'

import EpisodeDrawer from './EpisodeDrawer.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()
const auth = useAuthStore()
const library = useLibraryStore()
const ui = useUiStore()
const follow = useFollow()

const show = ref<Show | null>(null)
const ratings = ref<ShowRating[]>([])
const externalIds = ref<ShowExternalId[]>([])
const episodes = ref<Episode[]>([])
const episodeRatings = ref(new Map<number, number>())
const loading = ref(true)
const episodesLoading = ref(false)
const error = ref<string | null>(null)
const season = ref<number | null>(null)
const openEpisode = ref<Episode | null>(null)

const showId = computed(() => Number(props.id))
const entry = computed(() => library.entryFor(showId.value))
const tz = computed(() => auth.timezone)
const now = Date.now()

async function load() {
  loading.value = true
  error.value = null
  try {
    const [s] = await Promise.all([fetchShow(showId.value), library.load()])
    show.value = s
    if (!s) {
      error.value = 'This show is not in the catalog.'
      return
    }
    const [r, x] = await Promise.all([fetchShowRatings(s.id), fetchShowExternalIds(s.id)])
    ratings.value = r
    externalIds.value = x
    await loadEpisodes()
    if (
      !s.episodes_synced_at ||
      Date.now() - new Date(s.episodes_synced_at).getTime() > 6 * 3_600_000
    )
      void refreshEpisodes()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function loadEpisodes() {
  if (!show.value) return
  episodes.value = await fetchEpisodesForShow(show.value.id)
  episodeRatings.value = await fetchEpisodeRatings(episodes.value.map((e) => e.id))
  if (season.value === null || !seasons.value.includes(season.value)) {
    const aired = episodes.value.filter((e) => e.airstamp && new Date(e.airstamp).getTime() < now)
    season.value = (aired[aired.length - 1] ?? episodes.value[0])?.season ?? null
  }
}

/** Pull the complete episode list from TVMaze when it has never been synced or is stale. */
async function refreshEpisodes() {
  if (!show.value || episodesLoading.value) return
  episodesLoading.value = true
  try {
    const res = await invokeFunction<{ refreshed: boolean }>('refresh-show', {
      tvmaze_id: show.value.tvmaze_id,
    })
    if (res.refreshed) {
      show.value = (await fetchShow(showId.value)) ?? show.value
      await loadEpisodes()
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
  episodes.value.find((e) => e.airstamp && new Date(e.airstamp).getTime() > now - 30 * 60_000),
)

const genres = computed(() => show.value?.genres ?? [])
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
    .join('  ·  ')
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

async function setRating(rating: number | null) {
  if (!show.value) return
  try {
    // Rating an untracked show adds it as completed; otherwise just update the rating.
    await library.update(
      show.value.id,
      entry.value ? { rating } : { rating, status: 'completed' },
      show.value.tvmaze_id,
    )
  } catch (err) {
    ui.error(errorMessage(err))
  }
}
async function setStatus(status: UserShowStatus) {
  if (!show.value) return
  try {
    await library.update(show.value.id, { status }, show.value.tvmaze_id)
  } catch (err) {
    ui.error(errorMessage(err))
  }
}
async function setNotify(notify: boolean) {
  if (!show.value) return
  try {
    await library.update(show.value.id, { notify }, show.value.tvmaze_id)
    ui.toast(notify ? 'Alerts on for this show' : 'Alerts muted for this show')
  } catch (err) {
    ui.error(errorMessage(err))
  }
}
function toggleFollow() {
  if (show.value) void follow.toggle(show.value.id, show.value.tvmaze_id, show.value.name)
}
function episodeMeta(e: Episode): string {
  const r = episodeRatings.value.get(e.id)
  return [
    e.airdate ? formatPlainDate(e.airdate) : 'TBA',
    formatRuntime(e.runtime),
    r ? `★ ${r}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
function openFromDrawer(e: Episode) {
  openEpisode.value = e
  season.value = e.season
}
function isFuture(e: Episode): boolean {
  return !!e.airstamp && new Date(e.airstamp).getTime() > now
}
</script>

<template>
  <div class="show">
    <div><AButton variant="ghost" size="sm" icon="back" @click="router.back()">Back</AButton></div>

    <AAlert v-if="error" variant="error">{{ error }}</AAlert>
    <ASkeleton v-else-if="loading" height="340px" radius="22px" />

    <template v-else-if="show">
      <section class="hero">
        <img
          v-if="show.image_original ?? show.image_medium"
          :src="show.image_original ?? show.image_medium ?? ''"
          alt=""
          class="hero__bg"
        />
        <div class="hero__inner">
          <APoster :src="show.image_medium" :alt="show.name" radius="lg" class="hero__poster" />
          <div class="hero__text">
            <div v-if="genres.length" class="hero__genres">
              <ABadge v-for="g in genres" :key="g" variant="outline" :mono="false">{{ g }}</ABadge>
            </div>
            <h1 class="hero__title">{{ show.name }}</h1>
            <div class="hero__meta">{{ meta }}</div>
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
            <APills
              :model-value="entry?.status ?? ''"
              :options="USER_SHOW_STATUSES"
              aria-label="Watch status"
              class="hero__status"
              @update:model-value="setStatus($event as UserShowStatus)"
            />
          </div>
        </div>
      </section>

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
            <span class="next__kicker"
              >Next episode · {{ relativeDayLabel(nextEpisode.airstamp!, tz) }}</span
            >
            <span class="next__title">{{ nextEpisode.name ?? 'TBA' }}</span>
            <span class="next__meta"
              >{{ episodeCode(nextEpisode.season, nextEpisode.number) }} ·
              {{ formatAirTime(nextEpisode.airstamp, tz) }}</span
            >
          </div>
          <div v-if="entry" class="alerts">
            <div class="alerts__text">
              <span class="alerts__title">Episode alerts</span>
              <span class="alerts__desc">{{
                entry.notify ? 'You will be told when new episodes air.' : 'Muted for this show.'
              }}</span>
            </div>
            <AButton
              variant="outline"
              size="sm"
              :icon="entry.notify ? 'bell' : 'bell'"
              @click="setNotify(!entry.notify)"
              >{{ entry.notify ? 'Mute' : 'Unmute' }}</AButton
            >
          </div>
        </div>
      </section>

      <section class="episodes">
        <div class="episodes__head">
          <span class="t-h2">Episodes</span>
          <span v-if="episodesLoading" class="episodes__sync t-mono">Syncing from TVmaze…</span>
          <AButton v-else variant="ghost" size="sm" icon="refresh" @click="refreshEpisodes"
            >Refresh</AButton
          >
        </div>
        <APills
          v-if="seasons.length > 1"
          :model-value="season ?? -1"
          :options="seasonOptions"
          mono
          aria-label="Season"
          @update:model-value="season = Number($event)"
        />
        <span class="episodes__count"
          >{{ seasonEpisodes.length }} episode{{ seasonEpisodes.length === 1 ? '' : 's'
          }}<template v-if="episodes.length"> · {{ episodes.length }} overall</template></span
        >

        <div v-if="!episodes.length && episodesLoading" class="episodes__skeleton">
          <ASkeleton v-for="i in 4" :key="i" height="90px" />
        </div>
        <div v-else-if="seasonEpisodes.length" class="episodes__list">
          <button
            v-for="e in seasonEpisodes"
            :key="e.id"
            type="button"
            class="episode"
            :class="{ 'episode--future': isFuture(e) }"
            @click="openEpisode = e"
          >
            <APoster :src="e.image_medium ?? show.image_medium" ratio="still" radius="md" />
            <span class="episode__text">
              <span class="episode__title">
                <span class="episode__code t-mono">{{
                  e.number === null ? 'SP' : `E${String(e.number).padStart(2, '0')}`
                }}</span>
                <span class="truncate">{{ e.name ?? 'TBA' }}</span>
              </span>
              <span class="episode__meta">{{ episodeMeta(e) }}</span>
              <span class="episode__sum clamp-2">{{ stripHtml(e.summary_html) }}</span>
            </span>
          </button>
        </div>
        <p v-else class="t-sub">No episodes listed yet.</p>
      </section>
    </template>

    <EpisodeDrawer
      :episode="openEpisode"
      :episodes="episodes"
      :show-name="show?.name ?? ''"
      :show-image="show?.image_medium ?? null"
      :timezone="tz"
      :rating="openEpisode ? episodeRatings.get(openEpisode.id) : undefined"
      @close="openEpisode = null"
      @navigate="openFromDrawer"
    />
  </div>
</template>

<style scoped>
.show {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.hero {
  position: relative;
  border-radius: var(--radius-3xl);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
}
.hero__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(56px) saturate(1.6);
  opacity: 0.42;
  transform: scale(1.3);
}
.hero__inner {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  align-items: flex-end;
  padding: 32px;
}
.hero__poster {
  width: 210px;
  flex: none;
  box-shadow: var(--shadow-poster);
}
.hero__text {
  flex: 1 1 300px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hero__genres {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.hero__title {
  font-size: 56px;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.98;
  text-wrap: balance;
}
.hero__meta {
  font: 500 13px var(--font-mono);
  color: var(--muted);
}
.hero__ratings {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-end;
  margin-top: 6px;
}
.score {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.score__value {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.score__scale {
  font-size: 14px;
  color: var(--muted);
  font-weight: 500;
}
.hero__status {
  margin-top: 4px;
}
.about {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
}
.about__text {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.about__summary {
  font-size: 16px;
  line-height: 1.6;
  text-wrap: pretty;
  max-width: 68ch;
}
.about__links {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.about__ext {
  color: var(--muted);
  margin-left: -2px;
}
.about__side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.next {
  border-radius: var(--radius-xl);
  background: var(--primary-soft);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.next__kicker {
  font: 600 11px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary-text);
}
.next__title {
  font-size: 17px;
  font-weight: 600;
}
.next__meta {
  font: 500 13px var(--font-mono);
  color: var(--muted);
}
.alerts {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--line);
  background: var(--surface);
}
.alerts__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.alerts__title {
  font-size: 14px;
  font-weight: 600;
}
.alerts__desc {
  font-size: 12.5px;
  color: var(--muted);
}
.episodes {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.episodes__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.episodes__sync {
  font-size: 12.5px;
  color: var(--primary-text);
}
.episodes__count {
  font-size: 13px;
  color: var(--muted);
  margin-top: -6px;
}
.episodes__skeleton,
.episodes__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.episodes__list {
  gap: 0;
}
.episode {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  padding: 10px 8px;
  margin: 0 -8px;
  border-radius: var(--radius-lg);
  border: 0;
  background: transparent;
  color: var(--fg);
  text-align: left;
}
.episode:hover {
  background: var(--hover);
}
.episode--future {
  opacity: 0.55;
}
.episode__text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.episode__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 15.5px;
  font-weight: 600;
}
.episode__code {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--primary-text);
  flex: none;
}
.episode__meta {
  font: 500 12.5px var(--font-mono);
  color: var(--muted);
}
.episode__sum {
  font-size: 13.5px;
  color: var(--muted);
  line-height: 1.45;
}
@media (max-width: 759px) {
  .hero__inner {
    padding: 20px;
  }
  .hero__poster {
    width: 130px;
  }
  .hero__title {
    font-size: 34px;
  }
  .about {
    grid-template-columns: minmax(0, 1fr);
  }
  .episode {
    grid-template-columns: 104px minmax(0, 1fr);
  }
  .episode__sum {
    display: none;
  }
}
</style>
