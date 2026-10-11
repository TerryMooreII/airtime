# Airtime

Track the TV shows you watch, rate them, and get told when new episodes air.
Vue 3 + Vite frontend, Supabase backend (Postgres, Auth, Edge Functions, pg_cron),
show data from [TVmaze](https://www.tvmaze.com) (CC BY-SA).

## Stack

| Layer    | Choice                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Frontend | Vue 3.5, Vite 8, TypeScript, Pinia, Vue Router, plain CSS design tokens (`src/design-system`)                           |
| Backend  | Supabase project `nhpwcxarlkdsdqlrjaxh`: Postgres + RLS, Auth (email/password), Edge Functions (Deno), pg_cron + pg_net |
| Data     | Full TVmaze show catalog mirrored locally; episodes for tracked shows; nightly schedule feed for upcoming episodes      |

## Local development

```bash
npm install
cp .env.example .env            # fill in VITE_SUPABASE_ANON_KEY (Supabase -> Settings -> API)
npm run dev                     # http://localhost:5173
npm run type-check && npm run lint && npm run build
```

The first account whose email is listed in `admin_bootstrap_emails` (seeded with terry@mooreii.com)
becomes an admin automatically on sign-up. Admins can promote other users from Admin -> Users.

## Supabase setup (one time)

1. **Migrations** live in `supabase/migrations` and were applied in order through the Supabase MCP.
   `0013_purge.sql` (weekly housekeeping, contains DELETEs) must be applied manually from the SQL editor.
2. **Auth**: Authentication -> URL Configuration -> set Site URL to your app origin and add
   `<origin>/auth/callback` and `<origin>/auth/reset-password` to Redirect URLs. Enable
   "Leaked password protection" under Auth -> Providers -> Email. For production email volume,
   configure custom SMTP.
3. **Edge Functions** (`supabase/functions`): `sync-worker`, `refresh-show`, `push-dispatch`, `admin-users`.
   Deploy with the MCP (`deploy_edge_function`, entrypoint `<name>/index.ts`, import map `deno.json`,
   include `_shared/*`) or the Supabase CLI.
4. **Web push**: generate a VAPID key pair (`npx web-push generate-vapid-keys`), set
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` as Edge Function secrets, and put the public
   key in `VITE_VAPID_PUBLIC_KEY`.
5. **Vault secrets** `project_url` and `anon_key` plus `app_settings.sync_secret` let pg_cron call the
   Edge Functions (see `0012_internal_auth.sql`). They are created by the migrations; nothing to paste.

## How data flows

```
TVmaze ──/shows?page=N──▶ catalog_page jobs ──▶ shows, channels, show_external_ids, show_ratings
TVmaze ──/schedule/full─▶ full_schedule (nightly 06:00 UTC) ──▶ episodes (upcoming, all shows) ──▶ new_episode notifications
TVmaze ──/updates/shows─▶ show_updates (nightly) ──▶ show_refresh jobs for changed shows
user tracks a show ──▶ trigger enqueues show_episodes ──▶ full episode history (refresh-show does it instantly)
hourly ──▶ create_airing_today_notifications() at each user's chosen local hour
every minute ──▶ tick_sync_worker() / tick_push_dispatch() wake the Edge Functions when there is work
```

All writes go through set-based SQL functions (`upsert_shows`, `upsert_episodes`, ...) so the Edge
Functions stay well under their CPU budget. The queue (`sync_queue`) is durable, de-duplicated,
retried with backoff, and visible in Admin -> Sync.

## Importing an existing list

Library -> **Import CSV** accepts a file (or pasted rows) of `show name, rating` with an optional header.
Names are fuzzy-matched against the local catalog (`match_show_candidates`, trigram KNN); you step
through every row, confirm or change the match, skip, or search for a different title. Confirmed rows
are upserted into `user_shows` with the chosen status; unmatched names are listed at the end.

## Cast and people

Cast lists and person pages are not stored locally. The browser fetches them from TVmaze's
public API (`src/lib/tvmaze.ts`), caches responses for the session, and limits itself to two
requests in flight. Credits link to local show pages when the show exists in the catalog.

## Adding another ratings provider (IMDb, Rotten Tomatoes, ...)

The schema is provider-agnostic:

- `show_external_ids (show_id, provider, external_id)` already holds `imdb` / `thetvdb` ids from TVmaze.
- `show_ratings (show_id, provider, value, scale, vote_count)` and `episode_ratings` take one row per provider.

Add a new `sync_job_type` (for example `omdb_ratings`), a handler in `sync-worker` that looks up shows by
`external_id`, and insert rows with `provider = 'imdb'`. The show page renders every provider it finds.

## Installable app (PWA)

`vite-plugin-pwa` generates the web manifest and builds `src/sw.js` with Workbox: the app shell
is precached (so the installed app opens offline), navigations fall back to `index.html`,
TVmaze posters and web fonts are cached at runtime, and the same worker shows Web Push
notifications. Updates install automatically and reload the page. Icons live in
`public/icons/` (`icon.svg` is the source; PNGs are rendered from it).

## Project layout

```
src/
  app/router          routes + auth/admin guards
  design-system/      tokens.css, base.css, A* components (see its README)
  features/           auth, home (guide), search, shows, library, notifications, settings, admin
  lib/                supabase client, generated database types, api helpers, formatting
  stores/             auth, library, notifications, ui (toasts)
supabase/
  migrations/         0001 ... 0015, applied in order
  functions/          Edge Functions + _shared helpers
design/               the original Claude Design mock (reference only)
```

## Watching progress

`user_episodes` records which episodes a user has seen. The show page has a check per aired
episode, a season progress bar and "Mark season watched"; marking a show Completed marks all
aired episodes watched (and catches up when the episode list arrives later). The Library
shows unwatched counts via `my_show_progress()`.

## Discover and the Guide's "Everything" scope

`discover_rails()` builds trending, new-series, top-genre, network and hero-pick rails from the
local catalog and the user's ratings; the "shares cast with" rail is assembled client-side from
TVmaze cast and credits. `upcoming_episodes_all()` powers the Guide's Everything scope (top 40
shows per day by TVmaze weight).

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` lints, builds and publishes `dist/` on every push to `main`
(or manually from the Actions tab). One-time setup:

1. Repository **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Secrets**: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` (the values from `.env`).
3. The site is served from `/<repo name>/`. For a custom domain or a `<user>.github.io`
   repository add the **variable** `PAGES_BASE` = `/`.
4. In Supabase **Authentication → URL Configuration** add the published origin as the Site
   URL and `<origin>/<base>/auth/callback` and `<origin>/<base>/auth/reset-password` as
   redirect URLs, otherwise verification and reset emails will link back to localhost.

The build copies `index.html` to `404.html` so deep links work without server rewrites, and
all in-app paths (router, service worker, brand icons, auth redirects) go through
`import.meta.env.BASE_URL` via `src/lib/url.ts`.

## Secrets

Public by design and fine to commit or ship: the Supabase project URL, the anon key (it is in
every browser bundle; Row Level Security and explicit grants are what protect the data) and
the VAPID public key.

Never committed: `.env`, `.vapid-keys.local` (VAPID private key), the service-role key, the
`sync_secret` row in `app_settings` and anything in `supabase/.temp`. All are gitignored, and
every Edge Function reads its secrets from `Deno.env`, Vault or `app_settings`. Migrations
that need a secret (`0012`) leave a placeholder and document the manual step.

In the GitHub repository turn on **Settings → Code security → Secret scanning** and **Push
protection** (free on public repos) as a safety net.

## Not yet built

- Email digests.
- Onboarding flow from the mock.
- Automated tests.
