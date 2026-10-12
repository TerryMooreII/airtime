<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  AAlert,
  AButton,
  AEmptyState,
  AFollowButton,
  APageHeader,
  APoster,
  ASectionHeader,
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
  <div class="discover">
    <APageHeader
      title="Discover"
      subtitle="Picked from your star ratings and what's on this week."
    />

    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>

    <template v-if="loading">
      <ASkeleton height="300px" radius="20px" />
      <div v-for="i in 3" :key="i" class="rail">
        <ASkeleton width="220px" height="22px" />
        <div class="rail__track">
          <ASkeleton v-for="j in 6" :key="j" width="156px" ratio="2 / 3" />
        </div>
      </div>
    </template>

    <template v-else-if="rails">
      <section v-if="pick" class="pick">
        <img
          v-if="pick.image_original ?? pick.image_medium"
          :src="pick.image_original ?? pick.image_medium ?? ''"
          alt=""
          class="pick__bg"
        />
        <div class="pick__inner">
          <RouterLink :to="{ name: 'show', params: { id: pick.id } }" class="pick__poster">
            <APoster :src="pick.image_medium" :alt="pick.name" radius="lg" />
          </RouterLink>
          <div class="pick__text">
            <span class="t-label pick__kicker">Top pick for you</span>
            <h2 class="pick__title">{{ pick.name }}</h2>
            <div class="pick__meta">{{ pickMeta }}</div>
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
          </div>
        </div>
      </section>

      <section v-for="rail in railList" :key="rail.key" class="rail">
        <ASectionHeader :title="rail.title" :subtitle="rail.reason" />
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
            width="156px"
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
.discover {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.pick {
  position: relative;
  border-radius: var(--radius-2xl);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
}
.pick__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(48px) saturate(1.5);
  opacity: 0.4;
  transform: scale(1.3);
}
.pick__inner {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  padding: 32px;
  align-items: center;
}
.pick__poster {
  width: 180px;
  flex: none;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  border-radius: var(--radius-lg);
}
.pick__text {
  flex: 1 1 280px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pick__kicker {
  color: var(--primary-text);
}
.pick__title {
  font-size: var(--text-hero);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1;
}
.pick__meta {
  font: 500 13px var(--font-mono);
  color: var(--muted);
}
.pick__summary {
  font-size: 15px;
  line-height: 1.55;
  max-width: 60ch;
  text-wrap: pretty;
}
.pick__reason {
  font-size: 13.5px;
  color: var(--muted);
}
.pick__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.rail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.rail__track {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding: 4px 4px 10px;
  margin: 0 -4px;
  scrollbar-width: thin;
}
.discover__note {
  font-size: 13px;
  margin-top: -16px;
}
@media (max-width: 759px) {
  .pick__inner {
    padding: 20px;
  }
  .pick__poster {
    width: 130px;
  }
  .pick__title {
    font-size: var(--text-hero-mobile);
  }
}
</style>
