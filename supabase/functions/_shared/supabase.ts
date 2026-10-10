import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

/** Service-role client: bypasses RLS. Only use inside trusted server code. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
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
