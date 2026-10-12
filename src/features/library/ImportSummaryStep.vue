<script setup lang="ts">
import { ABadge, AButton, ACard, AChoiceGroup, AIcon, AMediaRow } from '@/design-system'
import { plural, starString } from '@/lib/format'
import { USER_SHOW_STATUSES } from '@/types/domain'

import type { CsvImportReview } from './useCsvImportReview'

/** Step 3: what will and will not be imported, and the import button. */
defineProps<{ review: CsvImportReview }>()
</script>

<template>
  <div class="summary">
    <ACard padding="lg" radius="2xl" class="summary__card">
      <div class="summary__hero">
        <span class="summary__check"><AIcon name="check" :size="26" :stroke-width="2.6" /></span>
        <div>
          <h2 class="summary__title">All {{ review.rows.length }} rows reviewed</h2>
          <p class="t-sub">
            {{ review.counts.confirmed }} ready to import · {{ review.counts.skipped }} skipped ·
            {{ review.counts.unknown }} not found<template v-if="review.counts.pending">
              · {{ review.counts.pending }} still undecided (will be skipped)</template
            >
          </p>
        </div>
      </div>
      <div class="summary__status">
        <span class="t-label">Import as</span>
        <AChoiceGroup
          :model-value="review.importStatus"
          variant="segmented"
          :options="USER_SHOW_STATUSES"
          aria-label="Status for imported shows"
          @update:model-value="review.setImportStatus($event!)"
        />
      </div>
      <div class="cluster summary__actions">
        <AButton
          size="lg"
          icon="library"
          :loading="review.importing"
          :disabled="!review.counts.confirmed"
          @click="review.finish()"
        >
          Import {{ plural(review.counts.confirmed, 'show') }}
        </AButton>
        <AButton size="lg" variant="outline" icon="back" @click="review.backToReview()"
          >Back to review</AButton
        >
      </div>
    </ACard>

    <ACard v-if="review.confirmedRows.length" padding="lg">
      <span class="t-label">Will be imported ({{ review.confirmedRows.length }})</span>
      <ul class="summary__list">
        <li v-for="r in review.confirmedRows" :key="r.line">
          <AMediaRow
            :image="r.selected?.image_medium"
            :image-width="32"
            :title="r.selected?.name ?? r.name"
            :subtitle="
              r.selected && r.selected.name.toLowerCase() !== r.name.trim().toLowerCase()
                ? `from “${r.name}”`
                : undefined
            "
          >
            <template #trailing>
              <span class="summary__stars">{{ starString(r.rating) || '—' }}</span>
              <AButton variant="ghost" size="sm" @click="review.reviewRow(r)">Change</AButton>
            </template>
          </AMediaRow>
        </li>
      </ul>
    </ACard>
    <ACard v-if="review.unknownRows.length || review.skippedRows.length" padding="lg">
      <span class="t-label"
        >Not importing ({{ review.unknownRows.length + review.skippedRows.length }})</span
      >
      <ul class="summary__list summary__list--plain">
        <li v-for="r in [...review.unknownRows, ...review.skippedRows]" :key="r.line">
          <span class="summary__name truncate">{{ r.name }}</span>
          <ABadge :variant="r.candidates.length ? 'muted' : 'warning'">{{
            r.candidates.length ? 'skipped' : 'not found'
          }}</ABadge>
          <AButton variant="ghost" size="sm" @click="review.reviewRow(r)">Review</AButton>
        </li>
      </ul>
    </ACard>
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 820px;
}
.summary__card {
  gap: var(--space-4_5);
}
.summary__hero {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
.summary__check {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--success-soft);
  color: var(--success);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.summary__title {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin-bottom: var(--space-1);
}
.summary__status {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}
.summary__actions {
  --cluster-gap: var(--space-2_5);
}
.summary__list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.summary__list li {
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.summary__list--plain li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: var(--space-3);
  align-items: center;
}
.summary__list li:last-child {
  border-bottom: 0;
}
.summary__name {
  font-weight: 600;
}
.summary__stars {
  color: var(--star);
  font-size: var(--text-base);
  letter-spacing: 1px;
}
</style>
