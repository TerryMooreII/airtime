/**
 * URL helpers that respect the deploy base path (Vite's `base`, e.g. "/bingeTV/" on a
 * GitHub Pages project site). Use these instead of hard-coding paths that start with "/".
 */

/** The base path with a trailing slash, "/" in dev. */
export const BASE_PATH: string = import.meta.env.BASE_URL

/** Absolute URL of an in-app route, for auth redirects: appUrl('/auth/callback'). */
export function appUrl(path: string): string {
  return new URL(path.replace(/^\//, ''), window.location.origin + BASE_PATH).href
}

/** Path to a file in `public/`, e.g. publicAsset('brands/imdb.svg'). */
export function publicAsset(path: string): string {
  return BASE_PATH + path.replace(/^\//, '')
}
