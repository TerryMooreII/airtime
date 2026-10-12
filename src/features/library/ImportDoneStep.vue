<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { AAlert, AButton, ACard } from '@/design-system'
import { plural, starString } from '@/lib/format'
import { USER_SHOW_STATUSES } from '@/types/domain'

import type { CsvImportReview } from './useCsvImportReview'

/** Step 4: what was imported, what was not, and where to go next. */
defineProps<{ review: CsvImportReview }>()
</script>

<template>
  <div class="done">
    <AAlert variant="success" title="Import complete">
      {{ plural(review.imported, 'show') }} added to your library as “{{
        USER_SHOW_STATUSES.find((s) => s.value === review.importStatus)?.label
      }}”. Episode lists are being fetched in the background.
    </AAlert>
    <ACard v-if="review.unknownRows.length" padding="lg">
      <span class="t-label">Not found in the catalog ({{ review.unknownRows.length }})</span>
      <p class="t-sub done__p">
        These names didn't match anything. The catalog import may still be running, or the title is
        spelled differently on TVmaze.
      </p>
      <ul class="done__list">
        <li v-for="r in review.unknownRows" :key="r.line">
          <span>{{ r.name }}</span
          ><span class="t-muted">{{ starString(r.rating) }}</span>
        </li>
      </ul>
    </ACard>
    <ACard v-if="review.skippedRows.length" padding="lg">
      <span class="t-label">Skipped ({{ review.skippedRows.length }})</span>
      <ul class="done__list">
        <li v-for="r in review.skippedRows" :key="r.line">
          <span>{{ r.name }}</span>
        </li>
      </ul>
    </ACard>
    <div class="cluster done__actions">
      <AButton :to="{ name: 'library' }" icon="library">Open library</AButton>
      <AButton variant="outline" @click="review.reset()">Import another file</AButton>
      <RouterLink :to="{ name: 'search' }" class="done__link"
        >Search manually for the unknown ones</RouterLink
      >
    </div>
  </div>
</template>

<style scoped>
.done {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 760px;
}
.done__p {
  font-size: var(--text-base);
  margin: 6px 0 10px;
}
.done__list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
  font-size: var(--text-base);
}
.done__list li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}
.done__actions {
  --cluster-gap: var(--space-2_5);
}
.done__link {
  font-size: var(--text-base);
}
</style>
