/**
 * Application-level types. Row and enum shapes are derived from the generated schema
 * (src/lib/database.types.ts) so a migration that changes a column fails type-check here.
 */
import type { Enums, Tables } from '@/lib/database.types'

export type AppRole = Enums<'app_role'>
export type UserShowStatus = Enums<'user_show_status'>
export type NotificationType = Enums<'notification_type'>
export type SyncJobType = Enums<'sync_job_type'>
export type SyncStatus = Enums<'sync_status'>

export const USER_SHOW_STATUSES: { value: UserShowStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'plan_to_watch', label: 'Plan to watch' },
  { value: 'dropped', label: 'Dropped' },
]

export type Profile = Tables<'profiles'>

export type Channel = Pick<Tables<'channels'>, 'id' | 'kind' | 'name' | 'country_code' | 'timezone'>

export interface Show {
  id: number
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
  image_medium: string | null
  image_original: string | null
  summary_html: string | null
  tvmaze_url: string | null
  episodes_synced_at: string | null
  network: Channel | null
  web_channel: Channel | null
}

export interface ShowRating {
  provider: string
  value: number
  scale: number
  vote_count: number | null
}

export interface ShowExternalId {
  provider: string
  external_id: string
}

export type Episode = Pick<
  Tables<'episodes'>,
  | 'id'
  | 'season'
  | 'number'
  | 'type'
  | 'name'
  | 'airdate'
  | 'airtime'
  | 'airstamp'
  | 'runtime'
  | 'image_medium'
  | 'summary_html'
>

export type UserShow = Tables<'user_shows'>

/** A tracked show joined with its catalog row (Library view). */
export interface ChannelRef {
  name: string
  country_code?: string | null
}

export interface LibraryEntry extends UserShow {
  show: Pick<
    Show,
    'id' | 'tvmaze_id' | 'name' | 'status' | 'image_medium' | 'genres' | 'premiered' | 'type'
  > & { network: ChannelRef | null; web_channel: ChannelRef | null }
}

/** The fields every "show as a card or row" payload shares (search, discover, import). */
export interface ShowSummary {
  id: number
  tvmaze_id: number
  name: string
  status: string | null
  premiered: string | null
  image_medium: string | null
  network_name: string | null
  rating: number | null
}

export interface SearchResult extends ShowSummary {
  type: string | null
  genres: string[]
  language: string | null
  rank: number
}

/** A fuzzy-match candidate for one CSV import row (match_show_candidates RPC). */
export interface MatchCandidate extends ShowSummary {
  type: string | null
  score: number
  is_exact: boolean
}

export interface UpcomingEpisode {
  episode_id: number
  show_id: number
  show_name: string
  show_image: string | null
  season: number
  number: number | null
  episode_name: string | null
  airstamp: string
  runtime: number | null
  status: UserShowStatus | null
  /** Only present in the catalog-wide ("Everything") feed. */
  show_weight?: number
  followed?: boolean
}

export interface NotificationData {
  season?: number
  number?: number | null
  airstamp?: string
  episode_name?: string | null
  show_name?: string
  image?: string | null
  test?: boolean
}

export type AppNotification = Omit<Tables<'notifications'>, 'data' | 'push_sent_at'> & {
  data: NotificationData
}

export type SyncQueueJob = Omit<
  Tables<'sync_queue'>,
  'payload' | 'locked_by' | 'updated_at'
> & { payload: Record<string, unknown> }

export type SyncRun = Omit<Tables<'sync_runs'>, 'stats' | 'job_id' | 'worker'> & {
  stats: Record<string, unknown>
}

export interface AdminStats {
  shows: number
  shows_with_episodes: number
  episodes: number
  users: number
  tracked_shows: number
  notifications_24h: number
  queue: Record<SyncStatus, number> | null
  catalog_import: {
    last_page: number | null
    completed_at: string | null
    started_at: string | null
  } | null
  last_full_schedule: {
    status: SyncStatus
    finished_at: string
    stats: Record<string, unknown>
    error: string | null
  } | null
}

export interface AdminUser {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  banned_until: string | null
  display_name: string | null
  role: AppRole
  tracked_shows: number
}

// ---------------------------------------------------------------------------
// Cast and people: fetched live from TVmaze (not stored locally).
// ---------------------------------------------------------------------------
export interface CastMember {
  personId: number
  name: string
  image: string | null
  character: string | null
  characterImage: string | null
  self: boolean
  voice: boolean
}

export interface Person {
  id: number
  name: string
  image: string | null
  imageOriginal: string | null
  birthday: string | null
  deathday: string | null
  gender: string | null
  country: string | null
  url: string | null
}

export interface Credit {
  showTvmazeId: number
  showName: string
  showImage: string | null
  showUrl: string | null
  network: string | null
  premiered: string | null
  status: string | null
  character: string | null
  self: boolean
  voice: boolean
}

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------
export interface ShowCardData extends ShowSummary {
  image_original: string | null
  genres: string[]
  summary_html: string | null
  /** Present on "because" anchors: the user's own rating. */
  my_rating?: number | null
}

/** A card in the "shares cast with" rail: which cast member links the two shows. */
export interface CastRailItem extends ShowCardData {
  via: string
}

export interface DiscoverGenreRail {
  genre: string
  score: number
  because: ShowCardData | null
  items: ShowCardData[]
}

export interface DiscoverRails {
  trending: ShowCardData[]
  new_series: ShowCardData[]
  genres: DiscoverGenreRail[]
  network: { name: string | null; items: ShowCardData[] }
  top_rated_show: { id: number; tvmaze_id: number; name: string; my_rating: number | null } | null
  pick: ShowCardData | null
  pick_reason: ShowCardData | null
}

export interface ShowProgress {
  show_id: number
  aired: number
  watched: number
  next_unwatched_episode_id: number | null
}
