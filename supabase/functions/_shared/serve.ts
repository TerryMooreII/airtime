import { HttpError } from './auth.ts'
import { handleOptions, json } from './cors.ts'

/**
 * Shared request wrapper: CORS preflight, JSON error envelope, consistent logging.
 * Handlers throw HttpError for client errors; anything else is a 500.
 */
export function serve(name: string, handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    const options = handleOptions(req)
    if (options) return options
    try {
      return await handler(req)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      console.error(`${name} failed`, err)
      return json({ error: err instanceof Error ? err.message : 'error' }, status)
    }
  })
}
