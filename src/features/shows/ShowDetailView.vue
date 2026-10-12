<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { AAlert, ABackButton, AChoiceGroup, ASkeleton } from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useFollow } from '@/composables/useFollow'
import { useLibraryActions } from '@/composables/useLibraryActions'
import { useNow } from '@/composables/useNow'
import { fetchShowDetail, refreshShow } from '@/lib/api/shows'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import type { Episode, Show, ShowExternalId, ShowRating } from '@/types/domain'

import EpisodeDrawer from './EpisodeDrawer.vue'
import ShowAbout from './ShowAbout.vue'
import ShowCast from './ShowCast.vue'
import ShowEpisodes from './ShowEpisodes.vue'
import ShowHero from './ShowHero.vue'
import { useShowEpisodes } from './useShowEpisodes'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const library = useLibraryStore()
const follow = useFollow()
const actions = useLibraryActions()

const showId = computed(() => Number(props.id))
const entry = computed(() => library.entryFor(showId.value))
const tz = computed(() => auth.timezone)
const now = useNow(60_000)

const show = ref<Show | null>(null)
const ratings = ref<ShowRating[]>([])
const externalIds = ref<ShowExternalId[]>([])
const episodes = useShowEpisodes(showId, now)
const episodesSyncing = ref(false)
const openEpisode = ref<Episode | null>(null)

type Tab = 'episodes' | 'cast'
const tab = ref<Tab>('episodes')
const castCount = ref<number | undefined>(undefined)

/** Everything is keyed by the route's show id, so the whole page is one round of requests. */
const {
  loading,
  error,
  run: load,
} = useAsync(
  async () => {
    const [detail] = await Promise.all([
      fetchShowDetail(showId.value),
      episodes.load(),
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

/** Pull the complete episode list from TVmaze when it has never been synced or is stale. */
async function refreshEpisodes() {
  if (!show.value || episodesSyncing.value) return
  episodesSyncing.value = true
  try {
    const res = await refreshShow(show.value.tvmaze_id)
    if (res.refreshed) {
      const [detail] = await Promise.all([fetchShowDetail(showId.value), episodes.load()])
      if (detail) show.value = detail.show
    }
  } catch (err) {
    console.warn('refresh-show failed', err)
  } finally {
    episodesSyncing.value = false
  }
}

onMounted(load)
watch(showId, () => {
  episodes.reset()
  tab.value = 'episodes'
  castCount.value = undefined
  void load()
})

function toggleFollow() {
  if (show.value) void follow.toggle(show.value.id, show.value.tvmaze_id, show.value.name)
}
function openFromDrawer(e: Episode) {
  openEpisode.value = e
  episodes.season = e.season
}
</script>

<template>
  <div class="page show">
    <ABackButton :fallback="{ name: 'library' }" />

    <AAlert v-if="error" variant="error">{{ error }}</AAlert>
    <ASkeleton v-else-if="loading" height="340px" radius="22px" />

    <template v-else-if="show">
      <ShowHero
        :show="show"
        :entry="entry"
        :ratings="ratings"
        :follow-pending="follow.pending(show.id)"
        @rate="actions.rate(show, $event)"
        @set-status="actions.setStatus(show, $event)"
        @follow="toggleFollow"
      />

      <ShowAbout
        :show="show"
        :external-ids="externalIds"
        :next-episode="episodes.nextEpisode"
        :entry="entry"
        :tz="tz"
        @set-notify="actions.setNotify(show, $event)"
      />

      <AChoiceGroup
        v-model="tab"
        variant="tabs"
        :options="[
          { value: 'episodes', label: 'Episodes', count: episodes.episodes.length || undefined },
          { value: 'cast', label: 'Cast', count: castCount },
        ]"
        aria-label="Show sections"
      />

      <ShowEpisodes
        v-if="tab === 'episodes'"
        :state="episodes"
        :fallback-image="show.image_medium"
        :syncing="episodesSyncing"
        @open="openEpisode = $event"
        @refresh="refreshEpisodes"
      />
      <ShowCast v-else :tvmaze-id="show.tvmaze_id" @loaded="castCount = $event" />
    </template>

    <EpisodeDrawer
      :episode="openEpisode"
      :episodes="episodes.episodes"
      :show-name="show?.name ?? ''"
      :show-image="show?.image_medium ?? null"
      :timezone="tz"
      :rating="openEpisode ? episodes.ratings.get(openEpisode.id) : undefined"
      :watched="openEpisode ? episodes.isWatched(openEpisode) : false"
      :can-watch="openEpisode ? !episodes.isFuture(openEpisode) : false"
      @toggle-watched="openEpisode && episodes.toggleWatched(openEpisode)"
      @close="openEpisode = null"
      @navigate="openFromDrawer"
    />
  </div>
</template>

<style scoped>
.show {
  --page-gap: var(--space-7);
}
</style>
