/** Formatting helpers. All date output respects the given IANA timezone. */

const dateTimeCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`
  let f = dateTimeCache.get(key)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(undefined, { ...options, timeZone })
    } catch {
      f = new Intl.DateTimeFormat(undefined, options)
    }
    dateTimeCache.set(key, f)
  }
  return f
}

export function formatAirTime(iso: string | null, timeZone: string): string {
  if (!iso) return 'TBA'
  return formatter(timeZone, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function formatAirDate(iso: string | null, timeZone: string): string {
  if (!iso) return 'TBA'
  return formatter(timeZone, { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(iso),
  )
}

export function formatDateTime(iso: string | null, timeZone: string): string {
  if (!iso) return 'TBA'
  return formatter(timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** Calendar day key (YYYY-MM-DD) in the user's timezone, for grouping. */
export function dayKey(iso: string, timeZone: string): string {
  const parts = formatter(timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function relativeDayLabel(iso: string, timeZone: string): string {
  const today = dayKey(new Date().toISOString(), timeZone)
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000).toISOString(), timeZone)
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString(), timeZone)
  const key = dayKey(iso, timeZone)
  if (key === today) return 'Today'
  if (key === tomorrow) return 'Tomorrow'
  if (key === yesterday) return 'Yesterday'
  return formatter(timeZone, { weekday: 'long', month: 'short', day: 'numeric' }).format(
    new Date(iso),
  )
}

/** Compact day label for badges: "Today", "Tomorrow", "Tue" within a week, else "Oct 13". */
export function shortDayLabel(iso: string, timeZone: string): string {
  const key = dayKey(iso, timeZone)
  for (let d = 0; d < 7; d++) {
    const probe = dayKey(new Date(Date.now() + d * 86_400_000).toISOString(), timeZone)
    if (probe === key) {
      if (d === 0) return 'Today'
      if (d === 1) return 'Tomorrow'
      return formatter(timeZone, { weekday: 'short' }).format(new Date(iso))
    }
  }
  return formatter(timeZone, { month: 'short', day: 'numeric' }).format(new Date(iso))
}

export function formatPlainDate(date: string | null): string {
  if (!date) return '—'
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(y, m - 1, d))
}

export function yearOf(date: string | null): string {
  return date ? date.slice(0, 4) : ''
}

export function formatRuntime(minutes: number | null): string {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function episodeCode(season: number, number: number | null): string {
  const s = String(season).padStart(2, '0')
  return number === null ? `S${s}` : `S${s}E${String(number).padStart(2, '0')}`
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(iso),
  )
}

/** TVMaze summaries are HTML. Reduce them to plain text for safe rendering. */
export function stripHtml(html: string | null): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function initials(name: string | null | undefined, fallback = '?'): string {
  if (!name) return fallback
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export const STATUS_LABELS: Record<string, string> = {
  watching: 'Watching',
  completed: 'Completed',
  dropped: 'Dropped',
  plan_to_watch: 'Plan to watch',
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
