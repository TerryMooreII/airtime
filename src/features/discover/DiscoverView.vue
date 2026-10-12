<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  AAlert,
  AButton,
  AEmptyState,
  AFollowButton,
  AHeader,
  AMediaHero,
  APoster,
  AShowCard,
  ASkeleton,
} from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useFollow } from '@/composables/useFollow'
import { fetchDiscoverRails, fetchSharedCastRail } from '@/lib/api/discover'
import { catalogMeta, joinMeta, starString, stripHtml, yearOf } from '@/lib/format'
import { useLibraryStore } from '@/stores/library'
import {
  FOLLOW_OPTIONS,
  type CastRailItem,
  type DiscoverRails,
  type ShowCardData,
} from '@/types/domain'

const library = useLibraryStore()
const follow = useFollow()

const rails = ref<DiscoverRails | null>(null)

const castRail = ref<CastRailItem[]>([])
const castRailLoading = ref(false)

const {
  loading,
  error,
  run: load,
} = useAsync(
  async () => {
    const [r] = await Promise.all([fetchDiscoverRails(), library.load()])
    rails.value = r
    void loadCastRail(r)
  },
  { initialLoading: true },
)
onMounted(load)

/** "Shares cast with <top-rated show>": built from TVmaze cast + person credits. */
async function loadCastRail(r: DiscoverRails) {
  if (!r.top_rated_show) return
  castRailLoading.value = true
  try {
    castRail.value = await fetchSharedCastRail(r.top_rated_show, library.byShowId)
  } catch {
    castRail.value = []
  } finally {
    castRailLoading.value = false
  }
}

const meta = catalogMeta
const stars = starString
const pick = computed(() => rails.value?.pick ?? null)
const pickReason = computed(() => {
  const because = rails.value?.pick_reason
  if (!because) return 'Popular this week'
  return because.my_rating
    ? `Because you rated ${because.name} ${stars(because.my_rating)}`
    : `Because you follow ${because.name}`
})
const pickMeta = computed(() => {
  const p = pick.value
  if (!p) return ''
  return joinMeta(
    yearOf(p.premiered),
    p.genres.slice(0, 2).join(' · '),
    p.rating ? `★ ${p.rating}` : null,
    p.network_name,
  )
})

interface Rail {
  key: string
  title: string
  reason: string
  items: (ShowCardData & { via?: string })[]
}
const railList = computed<Rail[]>(() => {
  const r = rails.value
  if (!r) return []
  const out: Rail[] = [
    {
      key: 'trending',
      title: 'Trending on TVmaze',
      reason: 'Most-followed shows airing this week',
      items: r.trending,
    },
  ]
  if (r.top_rated_show && castRail.value.length >= 3)
    out.push({
      key: 'cast',
      title: `Shares cast with ${r.top_rated_show.name}`,
      reason: r.top_rated_show.my_rating
        ? `Your top-rated show · ${stars(r.top_rated_show.my_rating)}`
        : 'From a show you follow',
      items: castRail.value,
    })
  for (const g of r.genres) {
    out.push({
      key: `genre:${g.genre}`,
      title: `${g.genre} for you`,
      reason: g.because
        ? g.because.my_rating
          ? `Because you rated ${g.because.name} ${stars(g.because.my_rating)}`
          : `Because you follow ${g.because.name}`
        : '',
      items: g.items,
    })
  }
  if (r.network.name)
    out.push({
      key: 'network',
      title: `More on ${r.network.name}`,
      reason: 'The network you watch most',
      items: r.network.items,
    })
  out.push({
    key: 'new',
    title: 'New series this week',
    reason: 'Series premieres in the next 7 days',
    items: r.new_series,
  })
  return out.filter((rail) => rail.items.length >= 3)
})
</script>

<template>
  <div class="page discover">
    <AHeader title="Discover" subtitle="Picked from your star ratings and what's on this week." />

    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>

    <template v-if="loading">
      <ASkeleton height="300px" radius="20px" />
      <div v-for="i in 3" :key="i" class="rail">
        <ASkeleton width="220px" height="22px" />
        <div class="rail__track">
          <ASkeleton v-for="j in 6" :key="j" width="var(--rail-w)" ratio="2 / 3" />
        </div>
      </div>
    </template>

    <template v-else-if="rails">
      <AMediaHero
        v-if="pick"
        :title="pick.name"
        :backdrop="pick.image_original ?? pick.image_medium"
        kicker="Top pick for you"
        :meta="pickMeta"
        size="md"
        title-tag="h2"
        align="center"
        :media-width-mobile="130"
      >
        <template #media>
          <RouterLink :to="{ name: 'show', params: { id: pick.id } }">
            <APoster :src="pick.image_medium" :alt="pick.name" radius="lg" />
          </RouterLink>
        </template>
        <p class="pick__summary">{{ stripHtml(pick.summary_html).slice(0, 320) }}</p>
        <div class="pick__reason">{{ pickReason }}</div>
        <div class="pick__actions">
          <AFollowButton
            :following="library.byShowId.has(pick.id)"
            :loading="follow.pending(pick.id)"
            @toggle="follow.toggle(pick.id, pick.tvmaze_id, pick.name)"
          />
          <AButton variant="outline" :to="{ name: 'show', params: { id: pick.id } }"
            >Details</AButton
          >
        </div>
      </AMediaHero>

      <section v-for="rail in railList" :key="rail.key" class="rail">
        <AHeader level="section" :title="rail.title" :subtitle="rail.reason" />
        <div class="rail__track">
          <AShowCard
            v-for="s in rail.items"
            :key="s.id"
            :show-id="s.id"
            :name="s.name"
            :image="s.image_medium"
            :meta="s.via ? `with ${s.via}` : meta(s)"
            :following="library.byShowId.has(s.id)"
            :follow-loading="follow.pending(s.id)"
            :follow-options="FOLLOW_OPTIONS"
            rail
            @follow="(status) => follow.toggle(s.id, s.tvmaze_id, s.name, status)"
          />
        </div>
      </section>
      <p v-if="castRailLoading" class="t-muted discover__note">
        Looking up shows that share a cast with {{ rails.top_rated_show?.name }}…
      </p>

      <AEmptyState
        v-if="!railList.length && !pick"
        title="Nothing to recommend yet"
        description="Follow and rate a few shows and Discover fills itself in."
      >
        <AButton :to="{ name: 'search' }" icon="search">Find shows</AButton>
      </AEmptyState>
    </template>
  </div>
</template>

<style scoped>
.pick__summary {
  font-size: var(--text-md);
  line-height: 1.55;
  max-width: 60ch;
  text-wrap: pretty;
}
.pick__reason {
  font-size: var(--text-sm);
  color: var(--muted);
}
.pick__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-1);
}
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
}
.rail__track {
  display: flex;
  gap: var(--space-3_5);
  overflow-x: auto;
  padding: var(--space-1) var(--space-1) var(--space-2_5);
  margin: 0 -4px;
}
.discover__note {
  font-size: var(--text-sm);
  margin-top: -16px;
}
</style>
