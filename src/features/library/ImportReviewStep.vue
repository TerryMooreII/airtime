<script setup lang="ts">
import {
  ABadge,
  AButton,
  ACard,
  AEmptyState,
  AMediaRow,
  APoster,
  ASearchBox,
  AStarRating,
} from '@/design-system'
import { joinMeta, yearOf } from '@/lib/format'
import type { MatchCandidate } from '@/types/domain'

import type { CsvImportReview, ReviewRow } from './useCsvImportReview'

/** Step 2: one row at a time; pick a candidate, search for another, confirm or skip. */
defineProps<{ review: CsvImportReview; current: ReviewRow }>()

function meta(c: MatchCandidate): string {
  return joinMeta(yearOf(c.premiered), c.network_name, c.type)
}
const DECISION_VARIANT = {
  confirmed: 'success',
  skipped: 'muted',
  unknown: 'warning',
  pending: 'soft',
} as const
</script>

<template>
  <div class="review">
    <ACard padding="lg" radius="2xl" class="review__card">
      <div class="review__head">
        <span class="t-label"
          >Row {{ current.line }} · {{ review.index + 1 }} of {{ review.rows.length }}</span
        >
        <ABadge :variant="DECISION_VARIANT[current.decision]">{{ current.decision }}</ABadge>
      </div>
      <h2 class="review__name">{{ current.name }}</h2>
      <div class="cluster review__rating">
        <span class="t-label">Your rating</span>
        <AStarRating
          :model-value="current.rating"
          size="md"
          @update:model-value="review.setRating(current, $event)"
        />
        <span v-if="current.rating === null && current.ratingText" class="t-muted review__raw"
          >CSV said “{{ current.ratingText }}”</span
        >
      </div>

      <div v-if="current.candidates.length" class="cands">
        <span class="t-label">{{
          current.selected?.is_exact ? 'Exact match found' : 'Is it one of these?'
        }}</span>
        <div class="cands__grid">
          <button
            v-for="c in current.candidates"
            :key="c.id"
            type="button"
            class="cand"
            :class="{ 'cand--on': current.selected?.id === c.id }"
            @click="review.select(current, c)"
          >
            <APoster :src="c.image_medium" radius="md" />
            <span class="cand__name truncate">{{ c.name }}</span>
            <span class="cand__meta truncate">{{ meta(c) }}</span>
            <span class="cand__tag" :class="{ 'cand__tag--exact': c.is_exact }">{{
              c.is_exact ? 'Exact match' : `${Math.round(c.score * 100)}% similar`
            }}</span>
          </button>
        </div>
      </div>
      <AEmptyState
        v-else
        title="No match in the catalog"
        description="Search for it below, or skip it. Unmatched shows are listed at the end."
        compact
      />

      <div class="manual">
        <ASearchBox
          :model-value="review.manualQuery"
          placeholder="Search the catalog for a different match"
          @update:model-value="review.setManualQuery($event)"
        />
        <div v-if="review.manualResults.length" class="manual__results">
          <AMediaRow
            v-for="r in review.manualResults"
            :key="r.id"
            button
            :image="r.image_medium"
            :image-width="28"
            :title="r.name"
            :subtitle="joinMeta(yearOf(r.premiered), r.network_name)"
            @click="review.useManual(r)"
          />
        </div>
        <span v-else-if="review.manualLoading" class="t-muted">Searching…</span>
      </div>

      <div class="review__actions">
        <AButton
          variant="outline"
          :disabled="review.index === 0"
          icon="back"
          @click="review.goTo(review.index - 1)"
          >Back</AButton
        >
        <AButton variant="ghost" @click="review.skip()">Skip <kbd>S</kbd></AButton>
        <div class="review__spacer" />
        <AButton size="lg" :disabled="!current.selected" icon="check" @click="review.confirm()"
          >Confirm {{ current.selected ? `“${current.selected.name}”` : '' }} <kbd>↵</kbd></AButton
        >
      </div>
    </ACard>

    <aside class="review__side">
      <div class="cluster tally">
        <ABadge variant="success">{{ review.counts.confirmed }} confirmed</ABadge>
        <ABadge variant="muted">{{ review.counts.skipped }} skipped</ABadge>
        <ABadge variant="warning">{{ review.counts.unknown }} unknown</ABadge>
        <ABadge variant="soft">{{ review.counts.pending }} to review</ABadge>
      </div>
      <AButton
        v-if="review.hasPendingExact"
        variant="outline"
        size="sm"
        icon="check"
        @click="review.confirmAllExact()"
        >Confirm all exact matches</AButton
      >
      <ol class="list">
        <li v-for="(r, i) in review.rows" :key="r.line">
          <button
            type="button"
            class="list__item"
            :class="{ 'list__item--on': i === review.index, [`list__item--${r.decision}`]: true }"
            @click="review.goTo(i)"
          >
            <span class="list__dot" />
            <span class="list__name truncate">{{ r.name }}</span>
            <span class="list__match truncate">{{
              r.decision === 'confirmed' ? r.selected?.name : r.decision
            }}</span>
          </button>
        </li>
      </ol>
      <AButton size="lg" block variant="outline" icon="check" @click="review.finishReview()">
        Finish review
      </AButton>
    </aside>
  </div>
</template>

<style scoped>
.review {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: var(--space-5);
  align-items: start;
}
.review__card {
  gap: var(--space-4);
}
.review__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.review__name {
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.review__rating {
  --cluster-gap: var(--space-3);
}
.review__raw {
  font-size: var(--text-xs);
}
.cands {
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
}
.cands__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-3);
}
.cand {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: var(--space-1_5);
  border-radius: var(--radius-lg);
  border: 2px solid transparent;
  background: transparent;
  color: var(--fg);
  text-align: left;
  transition: border-color var(--dur-fast) var(--ease);
}
.cand:hover {
  background: var(--hover);
}
.cand--on {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.cand__name {
  font-size: var(--text-sm);
  font-weight: 600;
}
.cand__meta {
  font: 500 var(--text-2xs) var(--font-mono);
  color: var(--muted);
}
.cand__tag {
  align-self: flex-start;
  font: 600 var(--text-2xs) var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 7px;
  border-radius: var(--radius-badge);
  background: var(--surface2);
  color: var(--muted);
}
.cand__tag--exact {
  background: var(--success);
  color: var(--on-success);
}
.cand--on .cand__tag:not(.cand__tag--exact) {
  background: var(--primary);
  color: var(--on-primary);
}
.manual {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.manual__results {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  max-height: 260px;
  overflow: auto;
}
.review__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding-top: var(--space-1_5);
  border-top: 1px solid var(--line);
}
.review__spacer {
  flex: 1;
}
kbd {
  font: 600 var(--text-2xs) var(--font-mono);
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 1px 5px;
  opacity: 0.6;
  margin-left: var(--space-1);
}
.review__side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  position: sticky;
  top: calc(var(--header-h) + 16px);
}
.tally {
  --cluster-gap: var(--space-1_5);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  max-height: 50vh;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}
.list__item {
  width: 100%;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2);
  align-items: center;
  padding: 7px 10px;
  border: 0;
  background: transparent;
  color: var(--fg);
  text-align: left;
  font-size: var(--text-xs);
}
.list__item:hover,
.list__item--on {
  background: var(--hover);
}
.list__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--line2);
}
.list__item--confirmed .list__dot {
  background: var(--success);
}
.list__item--unknown .list__dot {
  background: var(--warning);
}
.list__item--skipped .list__dot {
  background: var(--muted);
}
.list__name {
  font-weight: 600;
}
.list__match {
  color: var(--muted);
  font: 500 var(--text-2xs) var(--font-mono);
}
@media (max-width: 899px) {
  .review {
    grid-template-columns: minmax(0, 1fr);
  }
  .review__side {
    position: static;
  }
}
</style>
