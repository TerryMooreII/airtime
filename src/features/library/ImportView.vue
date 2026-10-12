<script setup lang="ts">
import { computed } from 'vue'

import { AAlert, AButton, AHeader } from '@/design-system'

import ImportDoneStep from './ImportDoneStep.vue'
import ImportReviewStep from './ImportReviewStep.vue'
import ImportSummaryStep from './ImportSummaryStep.vue'
import ImportUploadStep from './ImportUploadStep.vue'
import { useCsvImportReview } from './useCsvImportReview'

const review = useCsvImportReview()

const subtitle = computed(() => {
  switch (review.step) {
    case 'upload':
      return 'Upload a CSV of show names and your 1–5 ratings. You confirm every match before anything is saved.'
    case 'review':
      return `Reviewed ${review.reviewed} of ${review.rows.length}`
    case 'summary':
      return 'Review complete. Nothing is saved until you import.'
    default:
      return 'Import finished'
  }
})
</script>

<template>
  <div class="page import" tabindex="-1" @keydown="review.onKey">
    <AHeader title="Import shows" :subtitle="subtitle">
      <AButton variant="ghost" size="sm" icon="back" :to="{ name: 'library' }">Library</AButton>
    </AHeader>

    <AAlert v-if="review.error" variant="error">{{ review.error }}</AAlert>

    <ImportUploadStep v-if="review.step === 'upload'" :review="review" />
    <ImportReviewStep
      v-else-if="review.step === 'review' && review.current"
      :review="review"
      :current="review.current"
    />
    <ImportSummaryStep v-else-if="review.step === 'summary'" :review="review" />
    <ImportDoneStep v-else-if="review.step === 'done'" :review="review" />
  </div>
</template>

<style scoped>
.import {
  outline: none;
}
</style>
