/**
 * Browser-side TVmaze client for data we do not mirror locally (cast, people).
 * Responses are cached for the session and requests are limited to two in
 * flight so a busy page stays well under TVmaze's 20 requests / 10 s.
 */
import type { CastMember, Credit, Person } from '@/types/domain'

const BASE = 'https://api.tvmaze.com'
const TTL_MS = 60 * 60 * 1000
const MAX_IN_FLIGHT = 2

const memory = new Map<string, { at: number; value: unknown }>()
let inFlight = 0
const waiters: (() => void)[] = []

function readSession(key: string): { at: number; value: unknown } | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as { at: number; value: unknown }) : null
  } catch {
    return null
  }
}
function writeSession(key: string, entry: { at: number; value: unknown }): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(entry))
  } catch {
    /* quota or private mode: memory cache still works */
  }
}

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => waiters.push(resolve))
  inFlight++
  try {
    return await fn()
  } finally {
    inFlight--
    waiters.shift()?.()
  }
}

/** GET a TVmaze path with caching. Returns null on 404. */
export async function tvmazeGet<T>(path: string): Promise<T | null> {
  const key = `tvmaze:${path}`
  const hit = memory.get(key) ?? readSession(key)
  if (hit && Date.now() - hit.at < TTL_MS) {
    memory.set(key, hit)
    return hit.value as T | null
  }
  return slot(async () => {
    const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
    if (res.status === 404) {
      const entry = { at: Date.now(), value: null }
      memory.set(key, entry)
      return null
    }
    if (!res.ok) throw new Error(`TVmaze responded ${res.status}`)
    const value = (await res.json()) as T
    const entry = { at: Date.now(), value }
    memory.set(key, entry)
    writeSession(key, entry)
    return value
  })
}

// ---------------------------------------------------------------------------
// Payload shapes (only what we read)
// ---------------------------------------------------------------------------
interface TvmazeImage {
  medium: string | null
  original: string | null
}
interface TvmazePerson {
  id: number
  name: string
  url: string | null
  image: TvmazeImage | null
  birthday: string | null
  deathday: string | null
  gender: string | null
  country: { name: string | null } | null
}
interface TvmazeCastEntry {
  person: TvmazePerson
  character: { name: string | null; image: TvmazeImage | null } | null
  self: boolean
  voice: boolean
}
interface TvmazeCreditEntry {
  self: boolean
  voice: boolean
  _links?: { character?: { name?: string | null } }
  _embedded?: {
    show?: {
      id: number
      name: string
      url: string | null
      image: TvmazeImage | null
      premiered: string | null
      status: string | null
      network?: { name: string } | null
      webChannel?: { name: string } | null
    }
  }
}

function toPerson(p: TvmazePerson): Person {
  return {
    id: p.id,
    name: p.name,
    image: p.image?.medium ?? null,
    imageOriginal: p.image?.original ?? p.image?.medium ?? null,
    birthday: p.birthday,
    deathday: p.deathday,
    gender: p.gender,
    country: p.country?.name ?? null,
    url: p.url,
  }
}

/** Main cast of a show, in TVmaze billing order. People appearing twice are merged. */
export async function fetchShowCast(tvmazeShowId: number): Promise<CastMember[]> {
  const rows = (await tvmazeGet<TvmazeCastEntry[]>(`/shows/${tvmazeShowId}/cast`)) ?? []
  const byPerson = new Map<number, CastMember>()
  for (const r of rows) {
    const existing = byPerson.get(r.person.id)
    const character = r.character?.name ?? null
    if (existing) {
      if (character && existing.character && !existing.character.includes(character))
        existing.character += ` / ${character}`
      continue
    }
    byPerson.set(r.person.id, {
      personId: r.person.id,
      name: r.person.name,
      image: r.person.image?.medium ?? null,
      character,
      characterImage: r.character?.image?.medium ?? null,
      self: r.self,
      voice: r.voice,
    })
  }
  return [...byPerson.values()]
}

export async function fetchPerson(personId: number): Promise<Person | null> {
  const p = await tvmazeGet<TvmazePerson>(`/people/${personId}`)
  return p ? toPerson(p) : null
}

/** Every show a person acted in, one entry per show, newest first. */
export async function fetchPersonCredits(personId: number): Promise<Credit[]> {
  const rows =
    (await tvmazeGet<TvmazeCreditEntry[]>(`/people/${personId}/castcredits?embed=show`)) ?? []
  const byShow = new Map<number, Credit>()
  for (const r of rows) {
    const show = r._embedded?.show
    if (!show) continue
    const character = r._links?.character?.name ?? null
    const existing = byShow.get(show.id)
    if (existing) {
      if (character && existing.character && !existing.character.includes(character))
        existing.character += ` / ${character}`
      continue
    }
    byShow.set(show.id, {
      showTvmazeId: show.id,
      showName: show.name,
      showImage: show.image?.medium ?? null,
      showUrl: show.url,
      network: show.network?.name ?? show.webChannel?.name ?? null,
      premiered: show.premiered,
      status: show.status,
      character,
      self: r.self,
      voice: r.voice,
    })
  }
  return [...byShow.values()].sort((a, b) => (b.premiered ?? '').localeCompare(a.premiered ?? ''))
}
