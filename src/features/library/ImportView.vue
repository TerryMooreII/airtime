<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import {
  AAlert,
  ABadge,
  AButton,
  ACard,
  AChoiceGroup,
  AEmptyState,
  AFileDrop,
  AHeader,
  AIcon,
  AMediaRow,
  APoster,
  ASearchBox,
  AStarRating,
  ATable,
  ATextarea,
  type TableColumn,
} from '@/design-system'
import { useAsync } from '@/composables/useAsync'
import { useDebouncedQuery } from '@/composables/useDebouncedQuery'
import { importTrackedShows, matchShowCandidates, toMatchCandidate } from '@/lib/api/import'
import { searchShows } from '@/lib/api/shows'
import { parseShowCsv, type CsvParseResult } from '@/lib/csv'
import { joinMeta, plural, starString, yearOf } from '@/lib/format'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import {
  USER_SHOW_STATUSES,
  type MatchCandidate,
  type SearchResult,
  type UserShowStatus,
} from '@/types/domain'

type Decision = 'pending' | 'confirmed' | 'skipped' | 'unknown'

interface ReviewRow {
  line: number
  name: string
  rating: number | null
  ratingText: string
  candidates: MatchCandidate[]
  selected: MatchCandidate | null
  decision: Decision
}

const library = useLibraryStore()
const ui = useUiStore()

const step = ref<'upload' | 'review' | 'summary' | 'done'>('upload')
const pasted = ref('')
const parsed = ref<CsvParseResult | null>(null)
const fileName = ref('')
const rows = ref<ReviewRow[]>([])
const index = ref(0)
const parseError = ref<string | null>(null)
const importStatus = ref<UserShowStatus>('completed')
const imported = ref(0)

// Inline catalog search for rows with no good candidate.
const {
  query: manualQuery,
  results: manualResults,
  loading: manualLoading,
} = useDebouncedQuery((q) => searchShows(q, 8), { empty: [] as SearchResult[], minLength: 2 })

const previewColumns: TableColumn[] = [
  { key: 'line', label: '#', width: '48px' },
  { key: 'name', label: 'Show' },
  { key: 'rating', label: 'Rating' },
]

const current = computed(() => rows.value[index.value] ?? null)
const counts = computed(() => {
  const c = { pending: 0, confirmed: 0, skipped: 0, unknown: 0 }
  for (const r of rows.value) c[r.decision]++
  return c
})
const reviewed = computed(() => rows.value.length - counts.value.pending)
const unknownRows = computed(() =>
  rows.value.filter(
    (r) => r.decision === 'unknown' || (r.decision === 'skipped' && !r.candidates.length),
  ),
)
const skippedRows = computed(() =>
  rows.value.filter((r) => r.decision === 'skipped' && r.candidates.length > 0),
)
const confirmedRows = computed(() => rows.value.filter((r) => r.decision === 'confirmed'))

// ---------------------------------------------------------------------------
// Step 1: upload / paste
// ---------------------------------------------------------------------------
async function onFile(file: File) {
  fileName.value = file.name
  pasted.value = await file.text()
  parse()
}
function parse() {
  parseError.value = null
  parsed.value = parseShowCsv(pasted.value)
  if (!parsed.value.rows.length)
    parseError.value = 'No rows found. Expected one show per line: name, rating (1–5).'
}

const {
  loading: matching,
  error: matchError,
  run: startReview,
} = useAsync(async () => {
  if (!parsed.value?.rows.length) return
  const names = parsed.value.rows.map((r) => r.name)
  const matches = await matchShowCandidates(names, 6)
  rows.value = parsed.value.rows.map((r) => {
    const candidates = matches.get(r.name.trim()) ?? []
    const exact = candidates.find((c) => c.is_exact)
    const best = exact ?? (candidates[0] && candidates[0].score >= 0.55 ? candidates[0] : null)
    return {
      line: r.line,
      name: r.name,
      rating: r.rating,
      ratingText: r.ratingText,
      candidates,
      selected: best,
      decision: candidates.length ? 'pending' : 'unknown',
    }
  })
  index.value = 0
  step.value = 'review'
  jumpToNextPending(-1)
})

// ---------------------------------------------------------------------------
// Step 2: review one row at a time
// ---------------------------------------------------------------------------
function select(row: ReviewRow, candidate: MatchCandidate) {
  row.selected = candidate
  if (row.decision === 'unknown') row.decision = 'pending'
}
function confirm() {
  const row = current.value
  if (!row?.selected) return
  row.decision = 'confirmed'
  advance()
}
function skip() {
  const row = current.value
  if (!row) return
  row.decision = row.candidates.length || row.selected ? 'skipped' : 'unknown'
  advance()
}
function advance() {
  manualQuery.value = ''
  manualResults.value = []
  const wasLast = index.value >= rows.value.length - 1
  if (wasLast || counts.value.pending === 0) {
    step.value = 'summary'
    return
  }
  index.value++
}
function reviewRow(r: ReviewRow) {
  step.value = 'review'
  goTo(rows.value.indexOf(r))
}
function backToReview() {
  step.value = 'review'
  jumpToNextPending(-1)
}
function jumpToNextPending(from: number) {
  const next = rows.value.findIndex((r, i) => i > from && r.decision === 'pending')
  if (next !== -1) index.value = next
}
function goTo(i: number) {
  index.value = i
  manualQuery.value = ''
  manualResults.value = []
}
function confirmAllExact() {
  let n = 0
  for (const r of rows.value) {
    if (r.decision === 'pending' && r.selected?.is_exact) {
      r.decision = 'confirmed'
      n++
    }
  }
  ui.toast(`Confirmed ${plural(n, 'exact match', 'exact matches')}`)
  if (counts.value.pending === 0) step.value = 'summary'
  else jumpToNextPending(-1)
}
function useManual(result: SearchResult) {
  const row = current.value
  if (!row) return
  const candidate = toMatchCandidate(result)
  if (!row.candidates.some((c) => c.id === candidate.id)) row.candidates.unshift(candidate)
  select(row, candidate)
  manualQuery.value = ''
  manualResults.value = []
}
function onKey(e: KeyboardEvent) {
  if (step.value !== 'review' || (e.target as HTMLElement)?.tagName === 'INPUT') return
  if (e.key === 'Enter') confirm()
  else if (e.key.toLowerCase() === 's') skip()
}

// ---------------------------------------------------------------------------
// Step 3: import
// ---------------------------------------------------------------------------
const {
  loading: importing,
  error: importError,
  run: finish,
} = useAsync(async () => {
  const items = confirmedRows.value
    .filter((r) => r.selected)
    .map((r) => ({ showId: r.selected!.id, rating: r.rating }))
  // The same show may appear twice; keep the last rating.
  const byShow = new Map(items.map((i) => [i.showId, i]))
  const stored = await importTrackedShows([...byShow.values()], importStatus.value)
  imported.value = stored.length
  library.mergeEntries(stored)
  step.value = 'done'
})
const error = computed(() => parseError.value ?? matchError.value ?? importError.value)

function reset() {
  step.value = 'upload'
  pasted.value = ''
  parsed.value = null
  rows.value = []
  fileName.value = ''
  parseError.value = null
}
function meta(c: MatchCandidate): string {
  return joinMeta(yearOf(c.premiered), c.network_name, c.type)
}
</script>

<template>
  <div class="page import" tabindex="-1" @keydown="onKey">
    <AHeader
      title="Import shows"
      :subtitle="
        step === 'upload'
          ? 'Upload a CSV of show names and your 1–5 ratings. You confirm every match before anything is saved.'
          : step === 'review'
            ? `Reviewed ${reviewed} of ${rows.length}`
            : step === 'summary'
              ? 'Review complete. Nothing is saved until you import.'
              : 'Import finished'
      "
    >
      <AButton variant="ghost" size="sm" icon="back" :to="{ name: 'library' }">Library</AButton>
    </AHeader>

    <AAlert v-if="error" variant="error">{{ error }}</AAlert>

    <!-- Step 1 ---------------------------------------------------------- -->
    <template v-if="step === 'upload'">
      <div class="upload">
        <AFileDrop
          label="Drop a CSV here or click to choose"
          hint="Columns: show name, rating (1–5). A header row is optional."
          @file="onFile"
        />
        <div class="t-label upload__or">or paste rows</div>
        <ATextarea
          v-model="pasted"
          :rows="7"
          mono
          placeholder="Breaking Bad, 5&#10;The Office, 4&#10;Severance, 5"
          :spellcheck="false"
          @update:model-value="parsed = null"
        />
        <div class="cluster upload__actions">
          <AButton variant="outline" :disabled="!pasted.trim()" @click="parse">Check rows</AButton>
          <span v-if="parsed" class="cluster upload__summary">
            <ABadge variant="success">{{ parsed.rows.length }} rows</ABadge>
            <ABadge v-if="parsed.skipped.length" variant="warning"
              >{{ parsed.skipped.length }} skipped</ABadge
            >
            <ABadge v-if="parsed.rows.some((r) => r.rating === null)" variant="muted"
              >{{ parsed.rows.filter((r) => r.rating === null).length }} without a valid
              rating</ABadge
            >
          </span>
        </div>
        <div v-if="parsed?.rows.length" class="upload__preview">
          <ATable :columns="previewColumns" :rows="parsed.rows.slice(0, 8)" row-key="line">
            <template #cell-line="{ value }"
              ><span class="t-mono t-muted">{{ value }}</span></template
            >
            <template #cell-rating="{ row }">
              <span v-if="row.rating">{{ starString(row.rating) }}</span
              ><span v-else class="t-muted">{{ row.ratingText || '—' }}</span>
            </template>
          </ATable>
          <p v-if="parsed.rows.length > 8" class="t-muted upload__more">
            … and {{ plural(parsed.rows.length - 8, 'more row') }}
          </p>
          <div class="upload__go">
            <div class="upload__status">
              <span class="t-label">Import as</span>
              <AChoiceGroup
                v-model="importStatus"
                variant="segmented"
                :options="USER_SHOW_STATUSES"
                aria-label="Status for imported shows"
              />
            </div>
            <AButton size="lg" :loading="matching" @click="startReview"
              >Match and review {{ parsed.rows.length }} shows</AButton
            >
          </div>
        </div>
      </div>
    </template>

    <!-- Step 2 ---------------------------------------------------------- -->
    <template v-else-if="step === 'review' && current">
      <div class="review">
        <ACard padding="lg" radius="2xl" class="review__card">
          <div class="review__head">
            <span class="t-label"
              >Row {{ current.line }} · {{ index + 1 }} of {{ rows.length }}</span
            >
            <ABadge
              :variant="
                current.decision === 'confirmed'
                  ? 'success'
                  : current.decision === 'skipped'
                    ? 'muted'
                    : current.decision === 'unknown'
                      ? 'warning'
                      : 'soft'
              "
              >{{ current.decision }}</ABadge
            >
          </div>
          <h2 class="review__name">{{ current.name }}</h2>
          <div class="cluster review__rating">
            <span class="t-label">Your rating</span>
            <AStarRating v-model="current.rating" size="md" />
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
                @click="select(current, c)"
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
              v-model="manualQuery"
              placeholder="Search the catalog for a different match"
            />
            <div v-if="manualResults.length" class="manual__results">
              <AMediaRow
                v-for="r in manualResults"
                :key="r.id"
                button
                :image="r.image_medium"
                :image-width="28"
                :title="r.name"
                :subtitle="joinMeta(yearOf(r.premiered), r.network_name)"
                @click="useManual(r)"
              />
            </div>
            <span v-else-if="manualLoading" class="t-muted">Searching…</span>
          </div>

          <div class="review__actions">
            <AButton variant="outline" :disabled="index === 0" icon="back" @click="goTo(index - 1)"
              >Back</AButton
            >
            <AButton variant="ghost" @click="skip">Skip <kbd>S</kbd></AButton>
            <div class="review__spacer" />
            <AButton size="lg" :disabled="!current.selected" icon="check" @click="confirm"
              >Confirm {{ current.selected ? `“${current.selected.name}”` : '' }}
              <kbd>↵</kbd></AButton
            >
          </div>
        </ACard>

        <aside class="review__side">
          <div class="cluster tally">
            <ABadge variant="success">{{ counts.confirmed }} confirmed</ABadge>
            <ABadge variant="muted">{{ counts.skipped }} skipped</ABadge>
            <ABadge variant="warning">{{ counts.unknown }} unknown</ABadge>
            <ABadge variant="soft">{{ counts.pending }} to review</ABadge>
          </div>
          <AButton
            v-if="rows.some((r) => r.decision === 'pending' && r.selected?.is_exact)"
            variant="outline"
            size="sm"
            icon="check"
            @click="confirmAllExact"
            >Confirm all exact matches</AButton
          >
          <ol class="list">
            <li v-for="(r, i) in rows" :key="r.line">
              <button
                type="button"
                class="list__item"
                :class="{ 'list__item--on': i === index, [`list__item--${r.decision}`]: true }"
                @click="goTo(i)"
              >
                <span class="list__dot" />
                <span class="list__name truncate">{{ r.name }}</span>
                <span class="list__match truncate">{{
                  r.decision === 'confirmed' ? r.selected?.name : r.decision
                }}</span>
              </button>
            </li>
          </ol>
          <AButton size="lg" block variant="outline" icon="check" @click="step = 'summary'">
            Finish review
          </AButton>
        </aside>
      </div>
    </template>

    <!-- Step 3: summary before import ---------------------------------- -->
    <template v-else-if="step === 'summary'">
      <div class="summary">
        <ACard padding="lg" radius="2xl" class="summary__card">
          <div class="summary__hero">
            <span class="summary__check"
              ><AIcon name="check" :size="26" :stroke-width="2.6"
            /></span>
            <div>
              <h2 class="summary__title">All {{ rows.length }} rows reviewed</h2>
              <p class="t-sub">
                {{ counts.confirmed }} ready to import · {{ counts.skipped }} skipped ·
                {{ counts.unknown }} not found<template v-if="counts.pending">
                  · {{ counts.pending }} still undecided (will be skipped)</template
                >
              </p>
            </div>
          </div>
          <div class="summary__status">
            <span class="t-label">Import as</span>
            <AChoiceGroup
              v-model="importStatus"
              variant="segmented"
              :options="USER_SHOW_STATUSES"
              aria-label="Status for imported shows"
            />
          </div>
          <div class="cluster summary__actions">
            <AButton
              size="lg"
              icon="library"
              :loading="importing"
              :disabled="!counts.confirmed"
              @click="finish"
            >
              Import {{ plural(counts.confirmed, 'show') }}
            </AButton>
            <AButton size="lg" variant="outline" icon="back" @click="backToReview"
              >Back to review</AButton
            >
          </div>
        </ACard>

        <ACard v-if="confirmedRows.length" padding="lg">
          <span class="t-label">Will be imported ({{ confirmedRows.length }})</span>
          <ul class="summary__list">
            <li v-for="r in confirmedRows" :key="r.line">
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
                  <AButton variant="ghost" size="sm" @click="reviewRow(r)">Change</AButton>
                </template>
              </AMediaRow>
            </li>
          </ul>
        </ACard>
        <ACard v-if="unknownRows.length || skippedRows.length" padding="lg">
          <span class="t-label">Not importing ({{ unknownRows.length + skippedRows.length }})</span>
          <ul class="summary__list summary__list--plain">
            <li v-for="r in [...unknownRows, ...skippedRows]" :key="r.line">
              <span class="summary__text"
                ><span class="summary__name truncate">{{ r.name }}</span></span
              >
              <ABadge :variant="r.candidates.length ? 'muted' : 'warning'">{{
                r.candidates.length ? 'skipped' : 'not found'
              }}</ABadge>
              <AButton variant="ghost" size="sm" @click="reviewRow(r)">Review</AButton>
            </li>
          </ul>
        </ACard>
      </div>
    </template>

    <!-- Step 4 ---------------------------------------------------------- -->
    <template v-else-if="step === 'done'">
      <div class="done">
        <AAlert variant="success" title="Import complete">
          {{ plural(imported, 'show') }} added to your library as “{{
            USER_SHOW_STATUSES.find((s) => s.value === importStatus)?.label
          }}”. Episode lists are being fetched in the background.
        </AAlert>
        <ACard v-if="unknownRows.length" padding="lg">
          <span class="t-label">Not found in the catalog ({{ unknownRows.length }})</span>
          <p class="t-sub done__p">
            These names didn't match anything. The catalog import may still be running, or the title
            is spelled differently on TVmaze.
          </p>
          <ul class="done__list">
            <li v-for="r in unknownRows" :key="r.line">
              <span>{{ r.name }}</span
              ><span class="t-muted">{{ starString(r.rating) }}</span>
            </li>
          </ul>
        </ACard>
        <ACard v-if="skippedRows.length" padding="lg">
          <span class="t-label">Skipped ({{ skippedRows.length }})</span>
          <ul class="done__list">
            <li v-for="r in skippedRows" :key="r.line">
              <span>{{ r.name }}</span>
            </li>
          </ul>
        </ACard>
        <div class="cluster done__actions">
          <AButton :to="{ name: 'library' }" icon="library">Open library</AButton>
          <AButton variant="outline" @click="reset">Import another file</AButton>
          <RouterLink :to="{ name: 'search' }" class="done__link"
            >Search manually for the unknown ones</RouterLink
          >
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.import {
  outline: none;
}
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
  transition: border-color var(--dur-fast);
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
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto auto;
  gap: var(--space-3);
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.summary__list--plain li {
  grid-template-columns: minmax(0, 1fr) auto auto;
}
.summary__list li:last-child {
  border-bottom: 0;
}

.summary__stars {
  color: var(--star);
  font-size: var(--text-base);
  letter-spacing: 1px;
}
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
@media (max-width: 899px) {
  .review {
    grid-template-columns: minmax(0, 1fr);
  }
  .review__side {
    position: static;
  }
}
</style>
