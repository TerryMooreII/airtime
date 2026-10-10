/**
 * Minimal TVMaze API client with a polite rate limiter (~15 req / 10 s), 429 retries
 * and normalizers that turn API objects into the row shapes expected by the
 * upsert_channels / upsert_shows / upsert_episodes SQL functions.
 */

export const TVMAZE_BASE = 'https://api.tvmaze.com'
const USER_AGENT = 'airtime/0.1 (+https://github.com/airtime)'
const MIN_INTERVAL_MS = 650
const MAX_RETRIES = 4

let lastRequestAt = 0

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()
}

/** GET a TVMaze path. Returns null on 404. Throws on other failures after retries. */
export async function tvmazeGet<T>(path: string): Promise<T | null> {
  const url = path.startsWith('http') ? path : `${TVMAZE_BASE}${path}`
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
    if (res.status === 404) {
      await res.body?.cancel()
      return null
    }
    if (res.status === 429 || res.status >= 500) {
      await res.body?.cancel()
      if (attempt === MAX_RETRIES) throw new Error(`TVMaze ${res.status} for ${path} after ${attempt} retries`)
      const backoff = Math.min(30_000, 2_000 * 2 ** attempt)
      await new Promise((r) => setTimeout(r, backoff))
      continue
    }
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`TVMaze ${res.status} for ${path}: ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  }
  return null
}

// ---------------------------------------------------------------------------
// API shapes (only the fields we use)
// ---------------------------------------------------------------------------
export interface TvmazeCountry {
  name: string | null
  code: string | null
  timezone: string | null
}

export interface TvmazeChannel {
  id: number
  name: string
  country: TvmazeCountry | null
  officialSite?: string | null
}

export interface TvmazeShow {
  id: number
  url: string
  name: string
  type: string | null
  language: string | null
  genres: string[] | null
  status: string | null
  runtime: number | null
  averageRuntime: number | null
  premiered: string | null
  ended: string | null
  officialSite: string | null
  schedule: { time: string | null; days: string[] | null } | null
  rating: { average: number | null } | null
  weight: number | null
  network: TvmazeChannel | null
  webChannel: TvmazeChannel | null
  dvdCountry: TvmazeCountry | null
  externals: Record<string, string | number | null> | null
  image: { medium: string | null; original: string | null } | null
  summary: string | null
  updated: number | null
  _embedded?: { episodes?: TvmazeEpisode[] }
}

export interface TvmazeEpisode {
  id: number
  url: string
  name: string | null
  season: number
  number: number | null
  type: string | null
  airdate: string | null
  airtime: string | null
  airstamp: string | null
  runtime: number | null
  rating: { average: number | null } | null
  image: { medium: string | null; original: string | null } | null
  summary: string | null
  _embedded?: { show?: TvmazeShow }
  _links?: { show?: { href: string } }
}

// ---------------------------------------------------------------------------
// Row shapes (match the jsonb_to_recordset definitions in 0007_functions.sql)
// ---------------------------------------------------------------------------
export interface ChannelRow {
  kind: 'network' | 'web_channel'
  tvmaze_id: number
  name: string
  country_code: string | null
  country_name: string | null
  timezone: string | null
  official_site: string | null
}

export interface ShowRow {
  tvmaze_id: number
  name: string
  type: string | null
  language: string | null
  genres: string[]
  status: string | null
  runtime: number | null
  average_runtime: number | null
  premiered: string | null
  ended: string | null
  official_site: string | null
  schedule_time: string | null
  schedule_days: string[]
  weight: number
  network_tvmaze_id: number | null
  web_channel_tvmaze_id: number | null
  dvd_country_code: string | null
  image_medium: string | null
  image_original: string | null
  summary_html: string | null
  tvmaze_url: string | null
  tvmaze_updated_at: string | null
  externals: Record<string, string>
  rating_average: number | null
}

export interface EpisodeRow {
  tvmaze_id: number
  show_tvmaze_id: number
  season: number
  number: number | null
  type: string | null
  name: string | null
  airdate: string | null
  airtime: string | null
  airstamp: string | null
  runtime: number | null
  image_medium: string | null
  image_original: string | null
  summary_html: string | null
  tvmaze_url: string | null
  rating_average: number | null
}

export function channelRows(show: TvmazeShow): ChannelRow[] {
  const rows: ChannelRow[] = []
  if (show.network) rows.push(toChannelRow(show.network, 'network'))
  if (show.webChannel) rows.push(toChannelRow(show.webChannel, 'web_channel'))
  return rows
}

function toChannelRow(c: TvmazeChannel, kind: ChannelRow['kind']): ChannelRow {
  return {
    kind,
    tvmaze_id: c.id,
    name: c.name,
    country_code: c.country?.code ?? null,
    country_name: c.country?.name ?? null,
    timezone: c.country?.timezone ?? null,
    official_site: c.officialSite ?? null,
  }
}

export function toShowRow(s: TvmazeShow): ShowRow {
  const externals: Record<string, string> = {}
  for (const [key, value] of Object.entries(s.externals ?? {})) {
    if (value !== null && value !== undefined && `${value}` !== '') externals[key] = `${value}`
  }
  return {
    tvmaze_id: s.id,
    name: s.name,
    type: s.type,
    language: s.language,
    genres: s.genres ?? [],
    status: s.status,
    runtime: s.runtime,
    average_runtime: s.averageRuntime,
    premiered: s.premiered || null,
    ended: s.ended || null,
    official_site: s.officialSite,
    schedule_time: s.schedule?.time || null,
    schedule_days: s.schedule?.days ?? [],
    weight: s.weight ?? 0,
    network_tvmaze_id: s.network?.id ?? null,
    web_channel_tvmaze_id: s.webChannel?.id ?? null,
    dvd_country_code: s.dvdCountry?.code ?? null,
    image_medium: s.image?.medium ?? null,
    image_original: s.image?.original ?? null,
    summary_html: s.summary,
    tvmaze_url: s.url,
    tvmaze_updated_at: s.updated ? new Date(s.updated * 1000).toISOString() : null,
    externals,
    rating_average: s.rating?.average ?? null,
  }
}

export function toEpisodeRow(e: TvmazeEpisode, showTvmazeId: number): EpisodeRow {
  return {
    tvmaze_id: e.id,
    show_tvmaze_id: showTvmazeId,
    season: e.season,
    number: e.number,
    type: e.type ?? 'regular',
    name: e.name,
    airdate: e.airdate || null,
    airtime: e.airtime || null,
    airstamp: e.airstamp || null,
    runtime: e.runtime,
    image_medium: e.image?.medium ?? null,
    image_original: e.image?.original ?? null,
    summary_html: e.summary,
    tvmaze_url: e.url,
    rating_average: e.rating?.average ?? null,
  }
}

/** Extract the numeric show id from an episode's _links.show.href. */
export function showIdFromLinks(e: TvmazeEpisode): number | null {
  const href = e._embedded?.show?.id ?? e._links?.show?.href
  if (typeof href === 'number') return href
  const match = href?.match(/\/shows\/(\d+)/)
  return match ? Number(match[1]) : null
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
