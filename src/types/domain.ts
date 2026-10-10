/** Application-level types. Column names mirror the public schema. */

export type AppRole = 'user' | 'admin'
export type UserShowStatus = 'watching' | 'completed' | 'dropped' | 'plan_to_watch'
export type NotificationType = 'new_episode' | 'airing_today' | 'show_status_changed'
export type SyncJobType =
  'catalog_page' | 'full_schedule' | 'show_updates' | 'show_refresh' | 'show_episodes'
export type SyncStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export const USER_SHOW_STATUSES: { value: UserShowStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'plan_to_watch', label: 'Plan to watch' },
  { value: 'dropped', label: 'Dropped' },
]

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  timezone: string
  role: AppRole
  notify_in_app: boolean
  notify_push: boolean
  airing_digest_hour: number
  created_at: string
  updated_at: string
}

export interface Channel {
  id: number
  kind: 'network' | 'web_channel'
  name: string
  country_code: string | null
  timezone: string | null
}

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

export interface Episode {
  id: number
  tvmaze_id: number
  show_id: number
  season: number
  number: number | null
  type: string
  name: string | null
  airdate: string | null
  airtime: string | null
  airstamp: string | null
  runtime: number | null
  image_medium: string | null
  summary_html: string | null
}

export interface UserShow {
  user_id: string
  show_id: number
  status: UserShowStatus
  rating: number | null
  notes: string | null
  notify: boolean
  added_at: string
  updated_at: string
}

/** A tracked show joined with its catalog row (Library view). */
export interface LibraryEntry extends UserShow {
  show: Pick<
    Show,
    'id' | 'tvmaze_id' | 'name' | 'status' | 'image_medium' | 'genres' | 'premiered' | 'type'
  >
}

export interface SearchResult {
  id: number
  tvmaze_id: number
  name: string
  type: string | null
  status: string | null
  premiered: string | null
  genres: string[]
  image_medium: string | null
  language: string | null
  network_name: string | null
  rating: number | null
  rank: number
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
  status: UserShowStatus
}

export interface AppNotification {
  id: number
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  show_id: number | null
  episode_id: number | null
  data: {
    season?: number
    number?: number | null
    airstamp?: string
    episode_name?: string | null
    show_name?: string
    image?: string | null
  }
  read_at: string | null
  created_at: string
}

export interface SyncQueueJob {
  id: number
  job_type: SyncJobType
  payload: Record<string, unknown>
  priority: number
  run_after: string
  attempts: number
  max_attempts: number
  status: SyncStatus
  locked_at: string | null
  last_error: string | null
  triggered_by: string
  created_at: string
}

export interface SyncRun {
  id: number
  job_type: SyncJobType
  status: SyncStatus
  started_at: string
  finished_at: string
  stats: Record<string, unknown>
  error: string | null
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
