import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

let service: SupabaseClient | null = null

/** Service-role client: bypasses RLS. Only use inside trusted server code. One per isolate. */
export function serviceClient(): SupabaseClient {
  service ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return service
}

/** Client acting as the calling user (RLS applies). */
export function userClient(authHeader: string): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Unwrap a PostgREST/RPC response or throw with context. */
export function unwrap<T>(
  result: { data: T | null; error: { message: string } | null },
  what: string,
): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`)
  return result.data as T
}
