<script setup lang="ts">
import {
  ABadge,
  AButton,
  AChoiceGroup,
  AFileDrop,
  ATable,
  ATextarea,
  type TableColumn,
} from '@/design-system'
import { plural, starString } from '@/lib/format'
import { USER_SHOW_STATUSES } from '@/types/domain'

import type { CsvImportReview } from './useCsvImportReview'

/** Step 1: drop or paste the CSV, check the parsed rows, pick the status, start matching. */
defineProps<{ review: CsvImportReview }>()

const PREVIEW_ROWS = 8
const previewColumns: TableColumn[] = [
  { key: 'line', label: '#', width: '48px' },
  { key: 'name', label: 'Show' },
  { key: 'rating', label: 'Rating' },
]
</script>

<template>
  <div class="upload">
    <AFileDrop
      label="Drop a CSV here or click to choose"
      hint="Columns: show name, rating (1–5). A header row is optional."
      @file="review.onFile"
    />
    <div class="t-label upload__or">or paste rows</div>
    <ATextarea
      :model-value="review.pasted"
      :rows="7"
      mono
      placeholder="Breaking Bad, 5&#10;The Office, 4&#10;Severance, 5"
      :spellcheck="false"
      @update:model-value="review.setPasted($event)"
    />
    <div class="cluster upload__actions">
      <AButton variant="outline" :disabled="!review.pasted.trim()" @click="review.parse()"
        >Check rows</AButton
      >
      <span v-if="review.parsed" class="cluster upload__summary">
        <ABadge variant="success">{{ review.parsed.rows.length }} rows</ABadge>
        <ABadge v-if="review.parsed.skipped.length" variant="warning"
          >{{ review.parsed.skipped.length }} skipped</ABadge
        >
        <ABadge v-if="review.parsed.rows.some((r) => r.rating === null)" variant="muted"
          >{{ review.parsed.rows.filter((r) => r.rating === null).length }} without a valid
          rating</ABadge
        >
      </span>
    </div>
    <div v-if="review.parsed?.rows.length" class="upload__preview">
      <ATable
        :columns="previewColumns"
        :rows="review.parsed.rows.slice(0, PREVIEW_ROWS)"
        row-key="line"
      >
        <template #cell-line="{ value }"
          ><span class="t-mono t-muted">{{ value }}</span></template
        >
        <template #cell-rating="{ row }">
          <span v-if="row.rating">{{ starString(row.rating) }}</span
          ><span v-else class="t-muted">{{ row.ratingText || '—' }}</span>
        </template>
      </ATable>
      <p v-if="review.parsed.rows.length > PREVIEW_ROWS" class="t-muted">
        … and {{ plural(review.parsed.rows.length - PREVIEW_ROWS, 'more row') }}
      </p>
      <div class="upload__go">
        <div class="upload__status">
          <span class="t-label">Import as</span>
          <AChoiceGroup
            :model-value="review.importStatus"
            variant="segmented"
            :options="USER_SHOW_STATUSES"
            aria-label="Status for imported shows"
            @update:model-value="review.setImportStatus($event!)"
          />
        </div>
        <AButton size="lg" :loading="review.matching" @click="review.startReview()"
          >Match and review {{ review.parsed.rows.length }} shows</AButton
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload {
  display: flex;
  flex-direction: column;
  gap: var(--space-3_5);
  max-width: 760px;
}
.upload__or {
  text-align: center;
}
.upload__actions {
  --cluster-gap: var(--space-3);
}
.upload__summary {
  --cluster-gap: var(--space-1_5);
}
.upload__preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.upload__go {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3_5);
}
.upload__status {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}
</style>
