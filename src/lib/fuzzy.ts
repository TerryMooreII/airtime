/**
 * Small client-side fuzzy matcher for filtering short lists (library titles).
 * Returns a score in [0, 1]; 0 means no match. Favors exact substrings, then
 * word-prefix matches, then in-order character subsequences with small gaps.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = normalize(query)
  const t = normalize(text)
  if (!q || !t) return 0
  if (t === q) return 1
  const idx = t.indexOf(q)
  if (idx !== -1) return 0.9 - Math.min(0.2, idx / Math.max(t.length, 1) / 5)

  // Every query token is a prefix of some word.
  const words = t.split(' ')
  const tokens = q.split(' ')
  if (tokens.every((tok) => words.some((w) => w.startsWith(tok)))) return 0.75

  // Ordered subsequence with gap penalty.
  let ti = 0
  let gaps = 0
  let lastHit = -1
  for (const ch of q) {
    if (ch === ' ') continue
    const found = t.indexOf(ch, ti)
    if (found === -1) return 0
    if (lastHit !== -1) gaps += found - lastHit - 1
    lastHit = found
    ti = found + 1
  }
  const density = 1 - Math.min(1, gaps / Math.max(q.length * 3, 1))
  return 0.3 + 0.35 * density
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Filter + rank items by a query; items below `threshold` are dropped. */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  text: (item: T) => string,
  threshold = 0.45,
): T[] {
  if (!query.trim()) return items
  return items
    .map((item) => ({ item, score: fuzzyScore(query, text(item)) }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item)
}
