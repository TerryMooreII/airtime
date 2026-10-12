<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { AAlert, AEmptyState, AHeader, AShowCard, AShowGrid, ASkeleton } from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useFollow } from '@/composables/useFollow'
import { fetchSharedCastRail } from '@/lib/api/discover'
import { fetchSimilarShows } from '@/lib/api/shows'
import { catalogMeta } from '@/lib/format'
import { useLibraryStore } from '@/stores/library'
import { FOLLOW_OPTIONS, type CastRailItem, type Show, type ShowCardData } from '@/types/domain'

/**
 * The Recommended tab: "More like this" from the catalog (genre overlap, ranked in SQL) and
 * "Because of the cast" from TVmaze credits. Both load when the tab first opens.
 */
const props = defineProps<{ show: Show }>()
const library = useLibraryStore()
const follow = useFollow()

const similar = ref<ShowCardData[] | null>(null)
const {
  loading: similarLoading,
  error: similarError,
  run: loadSimilar,
} = useAsync(async () => {
  similar.value = await fetchSimilarShows(props.show.id)
})

/** Shown only with enough entries to feel like a section; errors just hide it, as on Discover. */
const castPicks = ref<CastRailItem[]>([])
const castLoading = ref(false)
async function loadCast() {
  castLoading.value = true
  try {
    castPicks.value = await fetchSharedCastRail(props.show, library.byShowId, 12)
  } catch {
    castPicks.value = []
  } finally {
    castLoading.value = false
  }
}
const showCast = computed(() => castPicks.value.length >= 3)

function load() {
  void loadSimilar()
  void loadCast()
}
onMounted(load)
watch(() => props.show.id, load)

/** Genres both shows carry, in the order of this show's own list. */
function sharedGenres(s: ShowCardData): string {
  const shared = props.show.genres.filter((g) => s.genres.includes(g))
  return shared.length ? shared.join(' · ') : catalogMeta(s)
}
</script>

<template>
  <section class="recs">
    <div class="recs__section">
      <AHeader
        level="section"
        title="More like this"
        subtitle="Same genres, rated highly on TVmaze"
      />
      <AAlert v-if="similarError" variant="error" @retry="loadSimilar">{{ similarError }}</AAlert>
      <AShowGrid v-else-if="similarLoading || similar === null">
        <ASkeleton v-for="i in 8" :key="i" ratio="2 / 3" />
      </AShowGrid>
      <AEmptyState
        v-else-if="!similar.length"
        title="Nothing similar yet"
        description="No other rated shows in the catalog share a genre with this one."
        compact
      />
      <AShowGrid v-else>
        <AShowCard
          v-for="s in similar"
          :key="s.id"
          :show-id="s.id"
          :name="s.name"
          :image="s.image_medium"
          :meta="sharedGenres(s)"
          :following="follow.isFollowing(s.id)"
          :follow-loading="follow.pending(s.id)"
          :follow-options="FOLLOW_OPTIONS"
          @follow="(status) => follow.toggle(s.id, s.tvmaze_id, s.name, status)"
        />
      </AShowGrid>
    </div>

    <div v-if="castLoading || showCast" class="recs__section">
      <AHeader level="section" title="Because of the cast" subtitle="Other shows with this cast" />
      <AShowGrid v-if="castLoading">
        <ASkeleton v-for="i in 4" :key="i" ratio="2 / 3" />
      </AShowGrid>
      <AShowGrid v-else>
        <AShowCard
          v-for="s in castPicks"
          :key="s.id"
          :show-id="s.id"
          :name="s.name"
          :image="s.image_medium"
          :meta="`with ${s.via}`"
          :following="follow.isFollowing(s.id)"
          :follow-loading="follow.pending(s.id)"
          :follow-options="FOLLOW_OPTIONS"
          @follow="(status) => follow.toggle(s.id, s.tvmaze_id, s.name, status)"
        />
      </AShowGrid>
    </div>

    <p class="t-muted recs__credit">Ratings and cast data from TVmaze.</p>
  </section>
</template>

<style scoped>
.recs {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.recs__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
}
.recs__credit {
  font-size: var(--text-xs);
}
</style>
