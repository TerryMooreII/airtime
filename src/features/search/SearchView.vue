<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AAlert, AButton, AEmptyState, ASearchBox, AShowCard, ASkeleton } from '@/design-system'
import { useShowSearch } from '@/composables/useShowSearch'
import { useFollow } from '@/composables/useFollow'
import { yearOf } from '@/lib/format'
import type { SearchResult } from '@/types/domain'

const route = useRoute()
const router = useRouter()
const search = useShowSearch()
const follow = useFollow()

onMounted(() => {
  if (typeof route.query.q === 'string') search.query.value = route.query.q
})
watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string' && q !== search.query.value) search.query.value = q
    if (q === undefined && search.query.value) search.query.value = ''
  },
)
watch(search.query, (q) => {
  const current = typeof route.query.q === 'string' ? route.query.q : ''
  if (q !== current) void router.replace({ name: 'search', query: q ? { q } : {} })
})

const title = computed(() => (search.query.value.trim() ? `Results for “${search.query.value.trim()}”` : 'Search'))
const subtitle = computed(() => {
  if (search.loading.value) return 'Searching…'
  if (search.query.value.trim().length < 2) return 'Find any show in the catalog and add it to your library.'
  return `${search.results.value.length}${search.hasMore.value ? '+' : ''} show${search.results.value.length === 1 ? '' : 's'} found`
})

function meta(s: SearchResult): string {
  return [s.rating ? `★ ${s.rating}` : null, s.genres[0] ?? s.network_name ?? yearOf(s.premiered)].filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="search">
    <h1 class="t-h1">{{ title }}</h1>
    <ASearchBox v-model="search.query.value" placeholder="Search any show" size="lg" autofocus class="search__box" />
    <p class="t-sub search__sub">{{ subtitle }}</p>

    <AAlert v-if="search.error.value" variant="error">{{ search.error.value }}</AAlert>

    <div v-if="search.loading.value && !search.results.value.length" class="grid">
      <ASkeleton v-for="i in 8" :key="i" ratio="2 / 3" />
    </div>

    <div v-else-if="search.results.value.length" class="grid">
      <AShowCard
        v-for="s in search.results.value"
        :key="s.id"
        :show-id="s.id"
        :name="s.name"
        :image="s.image_medium"
        :meta="meta(s)"
        :following="follow.isFollowing(s.id)"
        :follow-loading="follow.pending(s.id)"
        @follow="follow.toggle(s.id, s.tvmaze_id)"
      />
    </div>

    <AEmptyState
      v-else-if="search.query.value.trim().length >= 2 && !search.loading.value"
      title="No shows match"
      description="Try a different spelling, or the show's original title."
    />

    <div v-if="search.hasMore.value" class="search__more">
      <AButton variant="outline" :loading="search.loading.value" @click="search.loadMore">Load more</AButton>
    </div>
  </div>
</template>

<style scoped>
.search {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.search__box {
  display: none;
}
.search__sub {
  margin-top: -8px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
  gap: var(--grid-gap);
}
.search__more {
  display: flex;
  justify-content: center;
}
@media (max-width: 759px) {
  .search__box {
    display: flex;
  }
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(var(--card-min-mobile), 1fr));
    gap: var(--grid-gap-mobile);
  }
}
</style>
