import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (see .env.example)')
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

/** Invoke an Edge Function with the current session and typed JSON response. */
export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (error) {
    const message = await extractFunctionError(error)
    throw new Error(message)
  }
  return data as T
}

async function extractFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const payload = (await ctx.json()) as { error?: string }
      if (payload?.error) return payload.error
    } catch {
      /* fall through */
    }
  }
  return error instanceof Error ? error.message : 'Request failed'
}
