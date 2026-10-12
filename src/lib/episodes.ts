/** Episode timing helpers shared by the Guide, the Library and the show page. */
import { dayKey, formatMonthDay, relativeDayLabel } from '@/lib/format'

export interface Airing {
  airstamp: string | null
  runtime?: number | null
}

const DEFAULT_RUNTIME_MIN = 30

/** When the episode is over, assuming 30 minutes when the runtime is unknown. */
export function endsAt(e: Airing): number {
  return e.airstamp
    ? new Date(e.airstamp).getTime() + (e.runtime ?? DEFAULT_RUNTIME_MIN) * 60_000
    : 0
}

export function startsAt(e: Airing): number {
  return e.airstamp ? new Date(e.airstamp).getTime() : Number.POSITIVE_INFINITY
}

/** Started already (or has no date). */
export function hasAired(e: Airing, now: number): boolean {
  return startsAt(e) <= now
}

export function isFuture(e: Airing, now: number): boolean {
  return startsAt(e) > now
}

/** Currently on air. */
export function isLive(e: Airing, now: number): boolean {
  return startsAt(e) <= now && endsAt(e) >= now
}

/** "in 3h 05m", "On now", "Aired". */
export function formatCountdown(e: Airing, now: number): string {
  if (endsAt(e) < now) return 'Aired'
  const minutes = Math.round((startsAt(e) - now) / 60_000)
  if (minutes <= 0) return 'On now'
  if (minutes < 60) return `in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `in ${hours}h ${String(minutes % 60).padStart(2, '0')}m`
  return `in ${Math.floor(hours / 24)}d ${hours % 24}h`
}

/** "E05", or "SP" for specials without a number. */
export function episodeNumberLabel(number: number | null): string {
  return number === null ? 'SP' : `E${String(number).padStart(2, '0')}`
}

export interface DayGroup<T> {
  key: string
  label: string
  sub: string
  items: T[]
}

/** Bucket items by local calendar day, in input order. */
export function groupByDay<T extends { airstamp: string }>(
  items: T[],
  timeZone: string,
): DayGroup<T>[] {
  const map = new Map<string, DayGroup<T>>()
  for (const e of items) {
    const key = dayKey(e.airstamp, timeZone)
    let g = map.get(key)
    if (!g) {
      g = {
        key,
        label: relativeDayLabel(e.airstamp, timeZone),
        sub: formatMonthDay(e.airstamp, timeZone),
        items: [],
      }
      map.set(key, g)
    }
    g.items.push(e)
  }
  return [...map.values()]
}
