import { computed, reactive, ref } from 'vue'

import { useAsync } from '@/composables/useAsync'
import { useDebouncedQuery } from '@/composables/useDebouncedQuery'
import { importTrackedShows, matchShowCandidates, toMatchCandidate } from '@/lib/api/import'
import { searchShows } from '@/lib/api/shows'
import { parseShowCsv, type CsvParseResult } from '@/lib/csv'
import { plural } from '@/lib/format'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import type { MatchCandidate, SearchResult, UserShowStatus } from '@/types/domain'

export type ImportStep = 'upload' | 'review' | 'summary' | 'done'
export type Decision = 'pending' | 'confirmed' | 'skipped' | 'unknown'

export interface ReviewRow {
  line: number
  name: string
  rating: number | null
  ratingText: string
  candidates: MatchCandidate[]
  selected: MatchCandidate | null
  decision: Decision
}

const MATCH_THRESHOLD = 0.55

/**
 * The CSV import flow: parse, match every name against the catalog, review each row
 * (confirm / change / skip), then import the confirmed ones. One reactive object so the
 * step components can take it as a single prop.
 */
export function useCsvImportReview() {
  const library = useLibraryStore()
  const ui = useUiStore()

  const step = ref<ImportStep>('upload')
  const pasted = ref('')
  const parsed = ref<CsvParseResult | null>(null)
  const fileName = ref('')
  const rows = ref<ReviewRow[]>([])
  const index = ref(0)
  const parseError = ref<string | null>(null)
  const importStatus = ref<UserShowStatus>('completed')
  const imported = ref(0)

  // Inline catalog search for rows with no good candidate.
  const manual = useDebouncedQuery((q) => searchShows(q, 8), {
    empty: [] as SearchResult[],
    minLength: 2,
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
  const hasPendingExact = computed(() =>
    rows.value.some((r) => r.decision === 'pending' && r.selected?.is_exact),
  )

  // ---- Step 1: upload / paste
  /** Typing new text invalidates the previous parse. */
  function setPasted(text: string) {
    pasted.value = text
    parsed.value = null
  }
  function setImportStatus(status: UserShowStatus) {
    importStatus.value = status
  }
  function setManualQuery(q: string) {
    manual.query.value = q
  }
  /** The reviewer can correct the rating the CSV gave a row. */
  function setRating(row: ReviewRow, rating: number | null) {
    row.rating = rating
  }
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
  const matcher = useAsync(async () => {
    if (!parsed.value?.rows.length) return
    const names = parsed.value.rows.map((r) => r.name)
    const matches = await matchShowCandidates(names, 6)
    rows.value = parsed.value.rows.map((r) => {
      const candidates = matches.get(r.name.trim()) ?? []
      const exact = candidates.find((c) => c.is_exact)
      const best =
        exact ?? (candidates[0] && candidates[0].score >= MATCH_THRESHOLD ? candidates[0] : null)
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

  // ---- Step 2: review one row at a time
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
  function clearManual() {
    manual.query.value = ''
    manual.results.value = []
  }
  function advance() {
    clearManual()
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
  function finishReview() {
    step.value = 'summary'
  }
  function jumpToNextPending(from: number) {
    const next = rows.value.findIndex((r, i) => i > from && r.decision === 'pending')
    if (next !== -1) index.value = next
  }
  function goTo(i: number) {
    index.value = i
    clearManual()
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
    clearManual()
  }
  /** Keyboard shortcuts while reviewing: Enter confirms, S skips. */
  function onKey(e: KeyboardEvent) {
    if (step.value !== 'review' || (e.target as HTMLElement)?.tagName === 'INPUT') return
    if (e.key === 'Enter') confirm()
    else if (e.key.toLowerCase() === 's') skip()
  }

  // ---- Step 3: import
  const importer = useAsync(async () => {
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
  const error = computed(() => parseError.value ?? matcher.error.value ?? importer.error.value)

  function reset() {
    step.value = 'upload'
    pasted.value = ''
    parsed.value = null
    rows.value = []
    fileName.value = ''
    parseError.value = null
  }

  return reactive({
    step,
    pasted,
    parsed,
    fileName,
    rows,
    index,
    importStatus,
    imported,
    manualQuery: manual.query,
    manualResults: manual.results,
    manualLoading: manual.loading,
    matching: matcher.loading,
    importing: importer.loading,
    error,
    current,
    counts,
    reviewed,
    unknownRows,
    skippedRows,
    confirmedRows,
    hasPendingExact,
    onFile,
    parse,
    setPasted,
    setImportStatus,
    setManualQuery,
    setRating,
    startReview: matcher.run,
    select,
    confirm,
    skip,
    reviewRow,
    backToReview,
    finishReview,
    goTo,
    confirmAllExact,
    useManual,
    onKey,
    finish: importer.run,
    reset,
  })
}

export type CsvImportReview = ReturnType<typeof useCsvImportReview>
