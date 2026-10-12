/** Shared helpers for the Supabase data layer. */

interface QueryResult {
  data: unknown
  error: { message: string } | null
}

/** Await a PostgREST/RPC query and throw its error, returning the (possibly null) row. */
export async function one<T>(query: PromiseLike<QueryResult>): Promise<T | null> {
  const { data, error } = await query
  if (error) throw error
  return (data as T | null) ?? null
}

/** Await a PostgREST/RPC query that returns rows; `[]` when there are none. */
export async function many<T>(query: PromiseLike<QueryResult>): Promise<T[]> {
  return (await one<T[]>(query)) ?? []
}

export const CHANNEL_FIELDS = 'id, kind, name, country_code, timezone'
/** Both channel embeds of a show (TV network and streaming service). */
export const CHANNEL_EMBEDS = `network:channels!shows_network_id_fkey(${CHANNEL_FIELDS}), web_channel:channels!shows_web_channel_id_fkey(${CHANNEL_FIELDS})`

/** numeric columns arrive as strings over PostgREST. */
export function num(value: string | number | null | undefined): number | null {
  return value == null ? null : Number(value)
}

/** Run `fn` over `items` in slices of `size`, at most `concurrency` slices at a time. */
export async function mapChunks<T, R>(
  items: T[],
  size: number,
  fn: (chunk: T[]) => Promise<R>,
  concurrency = 4,
): Promise<R[]> {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  const out: R[] = []
  for (let i = 0; i < chunks.length; i += concurrency)
    out.push(...(await Promise.all(chunks.slice(i, i + concurrency).map(fn))))
  return out
}
