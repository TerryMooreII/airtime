<script setup lang="ts">
import { computed, watch } from 'vue'

import { AAlert, AButton, AEmptyState, ASearchBox, AShowCard, ASkeleton } from '@/design-system'
import { useFollow } from '@/composables/useFollow'
import { useQueryParam } from '@/composables/useQueryParam'
import { useShowSearch } from '@/composables/useShowSearch'
import { catalogMeta, plural } from '@/lib/format'
import { FOLLOW_OPTIONS } from '@/types/domain'

const search = useShowSearch()
const follow = useFollow()

// The query lives in the URL (?q=) so the header box, refresh and back button all agree.
const q = useQueryParam<string>('q', { defaultValue: '', parse: (r) => r })
watch(q, (v) => (search.query.value = v), { immediate: true })
watch(search.query, (v) => (q.value = v))

const title = computed(() =>
  search.query.value.trim() ? `Results for “${search.query.value.trim()}”` : 'Search',
)
const subtitle = computed(() => {
  if (search.loading.value) return 'Searching…'
  if (search.query.value.trim().length < 2)
    return 'Find any show in the catalog and add it to your library.'
  return `${plural(search.results.value.length, 'show')}${search.hasMore.value ? '+' : ''} found`
})
const meta = catalogMeta
</script>

<template>
  <div class="search">
    <h1 class="t-h1">{{ title }}</h1>
    <ASearchBox
      v-model="search.query.value"
      placeholder="Search any show"
      size="lg"
      autofocus
      class="search__box"
    />
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
        :follow-options="FOLLOW_OPTIONS"
        @follow="(status) => follow.toggle(s.id, s.tvmaze_id, s.name, status)"
      />
    </div>

    <AEmptyState
      v-else-if="search.query.value.trim().length >= 2 && !search.loading.value"
      title="No shows match"
      description="Try a different spelling, or the show's original title."
    />

    <div v-if="search.hasMore.value" class="search__more">
      <AButton variant="outline" :loading="search.loading.value" @click="search.loadMore"
        >Load more</AButton
      >
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
