/** Tiny CSV reader for the show import: handles quotes, commas/semicolons/tabs and CRLF. */

export interface CsvShowRow {
  line: number
  name: string
  rating: number | null
  /** Raw rating text when it could not be parsed as 1–5. */
  ratingText: string
}

export interface CsvParseResult {
  rows: CsvShowRow[]
  skipped: { line: number; reason: string; raw: string }[]
  hadHeader: boolean
}

function detectDelimiter(sample: string): string {
  const counts = [',', ';', '\t'].map((d) => ({
    d,
    n: (sample.match(new RegExp(`\\${d}`, 'g')) ?? []).length,
  }))
  return counts.sort((a, b) => b.n - a.n)[0]?.n ? counts[0]!.d : ','
}

function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

function parseRating(text: string): number | null {
  const m = text.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:\/\s*5)?$/)
  if (!m) return null
  const n = Math.round(Number(m[1]!.replace(',', '.')))
  return n >= 1 && n <= 5 ? n : null
}

/**
 * Accepts "name,rating" rows in any order of columns if a header names them
 * (name/title/show and rating/rank/stars/score); otherwise column 1 = name, column 2 = rating.
 */
export function parseShowCsv(text: string): CsvParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const delimiter = detectDelimiter(lines.slice(0, 20).join('\n'))
  const rows: CsvShowRow[] = []
  const skipped: CsvParseResult['skipped'] = []

  let nameIdx = 0
  let ratingIdx = 1
  let hadHeader = false
  const first = lines.find((l) => l.trim().length > 0)
  if (first) {
    const cells = splitLine(first, delimiter).map((c) => c.toLowerCase())
    const n = cells.findIndex((c) => ['name', 'title', 'show', 'show name', 'series'].includes(c))
    const r = cells.findIndex((c) =>
      ['rating', 'rank', 'ranking', 'stars', 'score', 'my rating'].includes(c),
    )
    if (n !== -1 || r !== -1) {
      hadHeader = true
      if (n !== -1) nameIdx = n
      if (r !== -1) ratingIdx = r
      else ratingIdx = nameIdx === 0 ? 1 : 0
    }
  }

  lines.forEach((raw, i) => {
    const line = i + 1
    if (!raw.trim()) return
    if (hadHeader && raw === first) return
    const cells = splitLine(raw, delimiter)
    const name = cells[nameIdx] ?? ''
    const ratingText = cells[ratingIdx] ?? ''
    if (!name) {
      skipped.push({ line, reason: 'No show name', raw })
      return
    }
    rows.push({ line, name, rating: parseRating(ratingText), ratingText })
  })

  return { rows, skipped, hadHeader }
}
