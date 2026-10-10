<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import {
  AAlert,
  ABadge,
  AButton,
  ACard,
  AEmptyState,
  AIcon,
  AFileDrop,
  APageHeader,
  APoster,
  ASearchBox,
  ASegmented,
  AStarRating,
} from '@/design-system'
import { errorMessage } from '@/composables/useAsync'
import { importTrackedShows, matchShowCandidates, type MatchCandidate } from '@/lib/api/import'
import { parseShowCsv, type CsvParseResult } from '@/lib/csv'
import { yearOf } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import { USER_SHOW_STATUSES, type SearchResult, type UserShowStatus } from '@/types/domain'

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
const matching = ref(false)
const importing = ref(false)
const error = ref<string | null>(null)
const importStatus = ref<UserShowStatus>('completed')
const imported = ref(0)

// Inline catalog search for rows with no good candidate.
const manualQuery = ref('')
const manualResults = ref<SearchResult[]>([])
const manualLoading = ref(false)
let manualTimer: ReturnType<typeof setTimeout> | undefined
watch(manualQuery, (q) => {
  clearTimeout(manualTimer)
  if (q.trim().length < 2) {
    manualResults.value = []
    return
  }
  manualTimer = setTimeout(async () => {
    manualLoading.value = true
    const { data } = await supabase.rpc('search_shows', { p_query: q.trim(), p_limit: 8 })
    manualResults.value = (data ?? []) as SearchResult[]
    manualLoading.value = false
  }, 250)
})

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
  error.value = null
  parsed.value = parseShowCsv(pasted.value)
  if (!parsed.value.rows.length)
    error.value = 'No rows found. Expected one show per line: name, rating (1–5).'
}

async function startReview() {
  if (!parsed.value?.rows.length) return
  matching.value = true
  error.value = null
  try {
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
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    matching.value = false
  }
}

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
  ui.toast(`Confirmed ${n} exact match${n === 1 ? '' : 'es'}`)
  if (counts.value.pending === 0) step.value = 'summary'
  else jumpToNextPending(-1)
}
function useManual(result: SearchResult) {
  const row = current.value
  if (!row) return
  const candidate: MatchCandidate = {
    id: result.id,
    tvmaze_id: result.tvmaze_id,
    name: result.name,
    type: result.type,
    status: result.status,
    premiered: result.premiered,
    image_medium: result.image_medium,
    network_name: result.network_name,
    rating: result.rating,
    score: 1,
    is_exact: false,
  }
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
async function finish() {
  importing.value = true
  error.value = null
  try {
    const items = confirmedRows.value
      .filter((r) => r.selected)
      .map((r) => ({ showId: r.selected!.id, rating: r.rating }))
    // The same show may appear twice; keep the last rating.
    const byShow = new Map(items.map((i) => [i.showId, i]))
    imported.value = await importTrackedShows([...byShow.values()], importStatus.value)
    await library.load(true)
    step.value = 'done'
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    importing.value = false
  }
}
function reset() {
  step.value = 'upload'
  pasted.value = ''
  parsed.value = null
  rows.value = []
  fileName.value = ''
  error.value = null
}
function meta(c: MatchCandidate): string {
  return [yearOf(c.premiered), c.network_name, c.type].filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="import" tabindex="-1" @keydown="onKey">
    <APageHeader
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
    </APageHeader>

    <AAlert v-if="error" variant="error">{{ error }}</AAlert>

    <!-- Step 1 ---------------------------------------------------------- -->
    <template v-if="step === 'upload'">
      <div class="upload">
        <AFileDrop
          label="Drop a CSV here or click to choose"
          hint="Columns: show name, rating (1–5). A header row is optional."
          @file="onFile"
        />
        <div class="upload__or">or paste rows</div>
        <textarea
          v-model="pasted"
          class="upload__paste"
          rows="7"
          placeholder="Breaking Bad, 5&#10;The Office, 4&#10;Severance, 5"
          spellcheck="false"
          @input="parsed = null"
        />
        <div class="upload__actions">
          <AButton variant="outline" :disabled="!pasted.trim()" @click="parse">Check rows</AButton>
          <span v-if="parsed" class="upload__summary">
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
          <table class="preview">
            <thead>
              <tr>
                <th>#</th>
                <th>Show</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in parsed.rows.slice(0, 8)" :key="r.line">
                <td class="t-mono t-muted">{{ r.line }}</td>
                <td>{{ r.name }}</td>
                <td>
                  <span v-if="r.rating">{{ '★'.repeat(r.rating) }}</span
                  ><span v-else class="t-muted">{{ r.ratingText || '—' }}</span>
                </td>
              </tr>
              <tr v-if="parsed.rows.length > 8">
                <td colspan="3" class="t-muted">… and {{ parsed.rows.length - 8 }} more</td>
              </tr>
            </tbody>
          </table>
          <div class="upload__go">
            <div class="upload__status">
              <span class="t-label">Import as</span>
              <ASegmented
                v-model="importStatus"
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
          <div class="review__rating">
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
              <button
                v-for="r in manualResults"
                :key="r.id"
                type="button"
                class="manual__item"
                @click="useManual(r)"
              >
                <APoster :src="r.image_medium" radius="sm" class="manual__img" />
                <span class="manual__text"
                  ><span class="manual__name truncate">{{ r.name }}</span
                  ><span class="t-muted t-mono manual__meta">{{
                    [yearOf(r.premiered), r.network_name].filter(Boolean).join(' · ')
                  }}</span></span
                >
              </button>
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
          <div class="tally">
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
            <ASegmented
              v-model="importStatus"
              :options="USER_SHOW_STATUSES"
              aria-label="Status for imported shows"
            />
          </div>
          <div class="summary__actions">
            <AButton
              size="lg"
              icon="library"
              :loading="importing"
              :disabled="!counts.confirmed"
              @click="finish"
            >
              Import {{ counts.confirmed }} show{{ counts.confirmed === 1 ? '' : 's' }}
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
              <APoster :src="r.selected?.image_medium" radius="sm" class="summary__img" />
              <span class="summary__text">
                <span class="summary__name truncate">{{ r.selected?.name }}</span>
                <span
                  v-if="r.selected && r.selected.name.toLowerCase() !== r.name.trim().toLowerCase()"
                  class="t-muted summary__from truncate"
                  >from “{{ r.name }}”</span
                >
              </span>
              <span class="summary__stars">{{ r.rating ? '★'.repeat(r.rating) : '—' }}</span>
              <AButton variant="ghost" size="sm" @click="reviewRow(r)">Change</AButton>
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
          {{ imported }} show{{ imported === 1 ? '' : 's' }} added to your library as “{{
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
              ><span class="t-muted">{{ r.rating ? '★'.repeat(r.rating) : '' }}</span>
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
        <div class="done__actions">
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
  display: flex;
  flex-direction: column;
  gap: 24px;
  outline: none;
}
.upload {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 760px;
}
.upload__or {
  text-align: center;
  font: 600 11px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.upload__paste {
  width: 100%;
  border-radius: var(--radius-lg);
  background: var(--surface2);
  border: 1px solid transparent;
  color: var(--fg);
  padding: 12px 14px;
  font: 500 13.5px var(--font-mono);
  resize: vertical;
  outline: none;
}
.upload__paste:focus {
  border-color: var(--line2);
}
.upload__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.upload__summary {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.upload__preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.preview {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.preview th {
  text-align: left;
  font: 600 11px var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}
.preview td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}
.upload__go {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
}
.upload__status {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
  align-items: start;
}
.review__card {
  gap: 16px;
}
.review__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.review__name {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.review__rating {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.review__raw {
  font-size: 12.5px;
}
.cands {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cands__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}
.cand {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px;
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
  font-size: 13px;
  font-weight: 600;
}
.cand__meta {
  font: 500 11px var(--font-mono);
  color: var(--muted);
}
.cand__tag {
  align-self: flex-start;
  font: 600 10.5px var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 7px;
  border-radius: 6px;
  background: var(--surface2);
  color: var(--muted);
}
.cand__tag--exact {
  background: var(--success);
  color: #0a0a0b;
}
.cand--on .cand__tag:not(.cand__tag--exact) {
  background: var(--primary);
  color: var(--on-primary);
}
.manual {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.manual__results {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  overflow: auto;
}
.manual__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--fg);
  text-align: left;
}
.manual__item:hover {
  background: var(--hover);
}
.manual__img {
  width: 28px;
  flex: none;
}
.manual__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.manual__name {
  font-size: 13.5px;
  font-weight: 600;
}
.manual__meta {
  font-size: 11.5px;
}
.review__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px solid var(--line);
}
.review__spacer {
  flex: 1;
}
kbd {
  font: 600 10.5px var(--font-mono);
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 1px 5px;
  opacity: 0.6;
  margin-left: 4px;
}
.review__side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 84px;
}
.tally {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  gap: 8px;
  align-items: center;
  padding: 7px 10px;
  border: 0;
  background: transparent;
  color: var(--fg);
  text-align: left;
  font-size: 12.5px;
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
  font: 500 11.5px var(--font-mono);
}
.summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 820px;
}
.summary__card {
  gap: 18px;
}
.summary__hero {
  display: flex;
  align-items: center;
  gap: 16px;
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
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin-bottom: 4px;
}
.summary__status {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.summary__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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
  gap: 12px;
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
.summary__img {
  width: 32px;
}
.summary__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.summary__name {
  font-size: 14px;
  font-weight: 600;
}
.summary__from {
  font-size: 12px;
}
.summary__stars {
  color: var(--star);
  font-size: 14px;
  letter-spacing: 1px;
}
.done {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 760px;
}
.done__p {
  font-size: 14px;
  margin: 6px 0 10px;
}
.done__list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
}
.done__list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}
.done__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.done__link {
  font-size: 14px;
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
