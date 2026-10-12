<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

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
const router = useRouter()
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
  <div class="person">
    <div><AButton variant="ghost" size="sm" icon="back" @click="router.back()">Back</AButton></div>

    <AAlert v-if="error" variant="error" @retry="load">{{ error }}</AAlert>
    <ASkeleton v-else-if="loading" height="300px" radius="22px" />
    <AEmptyState
      v-else-if="!person"
      title="Person not found"
      description="TVmaze has no record for this id."
    />

    <template v-else>
      <section class="hero">
        <img v-if="person.imageOriginal" :src="person.imageOriginal" alt="" class="hero__bg" />
        <div class="hero__inner">
          <APoster :src="person.image" :alt="person.name" radius="lg" class="hero__photo" />
          <div class="hero__text">
            <span class="t-label hero__kicker">Cast member</span>
            <h1 class="hero__title">{{ person.name }}</h1>
            <div v-if="meta.length" class="hero__meta">{{ meta.join('  ·  ') }}</div>
            <div class="hero__links">
              <AButton v-if="person.url" :href="person.url" variant="outline" size="sm">
                <template #icon><ABrandIcon brand="tvmaze" :size="18" /></template>
                TVmaze<AIcon name="external" :size="13" class="hero__ext" />
              </AButton>
            </div>
          </div>
        </div>
      </section>

      <section class="credits">
        <div class="credits__head">
          <span class="t-h2">Shows</span>
          <span class="t-muted credits__count">{{ plural(credits.length, 'credit') }}</span>
        </div>
        <AEmptyState
          v-if="!credits.length"
          title="No credits listed"
          description="TVmaze doesn't list any shows for this person yet."
          compact
        />
        <div v-if="inCatalog.length" class="grid">
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
        </div>
        <template v-if="elsewhere.length">
          <div class="credits__sub">
            <span class="t-label">Not in the catalog yet</span>
            <ABadge variant="muted">opens on TVmaze</ABadge>
          </div>
          <div class="grid">
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
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.person {
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
  filter: blur(56px) saturate(1.4);
  opacity: 0.35;
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
.hero__photo {
  width: 180px;
  flex: none;
  box-shadow: var(--shadow-poster);
}
.hero__text {
  flex: 1 1 300px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hero__kicker {
  color: var(--primary-text);
}
.hero__title {
  font-size: 48px;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.98;
  text-wrap: balance;
}
.hero__meta {
  font: 500 13px var(--font-mono);
  color: var(--muted);
}
.hero__links {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.hero__ext {
  color: var(--muted);
  margin-left: -2px;
}
.credits {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.credits__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.credits__count {
  font: 500 13px var(--font-mono);
}
.credits__sub {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
  gap: var(--grid-gap);
}
.ext-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  color: var(--fg);
}
.ext-card__name {
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.25;
}
.ext-card__meta {
  font: 500 12px var(--font-mono);
  color: var(--muted);
  margin-top: -3px;
}
@media (max-width: 759px) {
  .hero__inner {
    padding: 20px;
  }
  .hero__photo {
    width: 120px;
  }
  .hero__title {
    font-size: 32px;
  }
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(var(--card-min-mobile), 1fr));
    gap: var(--grid-gap-mobile);
  }
}
</style>
