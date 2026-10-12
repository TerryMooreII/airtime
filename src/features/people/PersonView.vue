<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  AAlert,
  ABadge,
  ABrandIcon,
  AButton,
  AEmptyState,
  AIcon,
  APoster,
  AShowCard,
  ASkeleton,
} from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useFollow } from '@/composables/useFollow'
import { resolveLocalShows } from '@/lib/api/shows'
import { formatPlainDate, joinMeta, plural, yearOf } from '@/lib/format'
import { fetchPerson, fetchPersonCredits } from '@/lib/tvmaze'
import { useLibraryStore } from '@/stores/library'
import { FOLLOW_OPTIONS, type Credit, type Person } from '@/types/domain'

const props = defineProps<{ id: string }>()
const library = useLibraryStore()
const follow = useFollow()

const person = ref<Person | null>(null)
const credits = ref<Credit[]>([])
const localIds = ref(new Map<number, number>())

const {
  loading,
  error,
  run: load,
} = useAsync(
  async () => {
    person.value = null
    credits.value = []
    const personId = Number(props.id)
    const [p, c] = await Promise.all([
      fetchPerson(personId),
      fetchPersonCredits(personId),
      library.load(),
    ])
    person.value = p
    credits.value = c
    localIds.value = await resolveLocalShows(c.map((x) => x.showTvmazeId))
  },
  { initialLoading: true },
)
onMounted(load)
watch(() => props.id, load)

function age(p: Person): number | null {
  if (!p.birthday) return null
  const end = p.deathday ? new Date(p.deathday) : new Date()
  const born = new Date(p.birthday)
  let a = end.getFullYear() - born.getFullYear()
  if (end < new Date(end.getFullYear(), born.getMonth(), born.getDate())) a--
  return a
}
const meta = computed(() => {
  const p = person.value
  if (!p) return []
  const parts: string[] = []
  if (p.birthday)
    parts.push(`Born ${formatPlainDate(p.birthday)}${p.deathday ? '' : ` (${age(p)})`}`)
  if (p.deathday) parts.push(`Died ${formatPlainDate(p.deathday)} (${age(p)})`)
  if (p.country) parts.push(p.country)
  if (p.gender) parts.push(p.gender)
  return parts
})

function roleLabel(c: Credit): string {
  const base = c.self ? 'As themself' : c.character ? `as ${c.character}` : ''
  return joinMeta(base, c.voice ? '(voice)' : '', c.network, yearOf(c.premiered))
}
const inCatalog = computed(() => credits.value.filter((c) => localIds.value.has(c.showTvmazeId)))
const elsewhere = computed(() => credits.value.filter((c) => !localIds.value.has(c.showTvmazeId)))
</script>

<template>
  <div class="page person">
    <ABackButton />

    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>
    <ASkeleton v-else-if="loading" height="300px" radius="22px" />
    <AEmptyState
      v-else-if="!person"
      title="Person not found"
      description="TVmaze has no record for this id."
    />

    <template v-else>
      <AMediaHero
        :title="person.name"
        :backdrop="person.imageOriginal"
        kicker="Cast member"
        :meta="meta.join('  ·  ')"
        size="lg"
      >
        <template #media><APoster :src="person.image" :alt="person.name" radius="lg" /></template>
        <div class="hero__links">
          <AButton v-if="person.url" :href="person.url" variant="outline" size="sm">
            <template #icon><ABrandIcon brand="tvmaze" :size="18" /></template>
            TVmaze<AIcon name="external" :size="13" class="hero__ext" />
          </AButton>
        </div>
      </AMediaHero>

      <section class="credits">
        <AHeader level="section" title="Shows" :subtitle="plural(credits.length, 'credit')" />
        <AEmptyState
          v-if="!credits.length"
          title="No credits listed"
          description="TVmaze doesn't list any shows for this person yet."
          compact
        />
        <AShowGrid v-if="inCatalog.length">
          <AShowCard
            v-for="c in inCatalog"
            :key="c.showTvmazeId"
            :show-id="localIds.get(c.showTvmazeId)!"
            :name="c.showName"
            :image="c.showImage"
            :meta="roleLabel(c)"
            :following="follow.isFollowing(localIds.get(c.showTvmazeId)!)"
            :follow-loading="follow.pending(localIds.get(c.showTvmazeId)!)"
            :follow-options="FOLLOW_OPTIONS"
            @follow="
              (status) =>
                follow.toggle(localIds.get(c.showTvmazeId)!, c.showTvmazeId, c.showName, status)
            "
          />
        </AShowGrid>
        <template v-if="elsewhere.length">
          <div class="credits__sub">
            <span class="t-label">Not in the catalog yet</span>
            <ABadge variant="muted">opens on TVmaze</ABadge>
          </div>
          <AShowGrid>
            <a
              v-for="c in elsewhere"
              :key="c.showTvmazeId"
              :href="c.showUrl ?? undefined"
              target="_blank"
              rel="noopener noreferrer"
              class="ext-card"
            >
              <APoster :src="c.showImage" :alt="c.showName" radius="lg" />
              <span class="ext-card__name truncate">{{ c.showName }}</span>
              <span class="ext-card__meta truncate">{{ roleLabel(c) }}</span>
            </a>
          </AShowGrid>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.hero__links {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1_5);
}
.hero__ext {
  color: var(--muted);
  margin-left: -2px;
}
.credits {
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
}

.credits__sub {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  margin-top: var(--space-2_5);
}

.ext-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  color: var(--fg);
}
.ext-card__name {
  font-size: var(--text-base);
  font-weight: 600;
  line-height: 1.25;
}
.ext-card__meta {
  font: 500 var(--text-xs) var(--font-mono);
  color: var(--muted);
  margin-top: -3px;
}
</style>
