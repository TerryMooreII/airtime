import type { Session, User } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/domain'

/**
 * Session + profile state. `ready` resolves once the initial session has been
 * read from storage so router guards never redirect prematurely.
 */
export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const ready = ref(false)
  let readyPromise: Promise<void> | null = null

  const user = computed<User | null>(() => session.value?.user ?? null)
  const isAuthenticated = computed(() => Boolean(session.value))
  const isEmailVerified = computed(() => Boolean(user.value?.email_confirmed_at))
  const isAdmin = computed(() => profile.value?.role === 'admin')
  const timezone = computed(() => profile.value?.timezone ?? 'UTC')

  async function loadProfile(): Promise<void> {
    if (!user.value) {
      profile.value = null
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .maybeSingle()
    if (error) {
      console.error('failed to load profile', error)
      return
    }
    profile.value = (data as Profile | null) ?? null
  }

  function init(): Promise<void> {
    if (readyPromise) return readyPromise
    readyPromise = (async () => {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      await loadProfile()
      ready.value = true

      supabase.auth.onAuthStateChange((_event, next) => {
        const userChanged = next?.user?.id !== session.value?.user?.id
        session.value = next
        if (userChanged) void loadProfile()
      })
    })()
    return readyPromise
  }

  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ needsVerification: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    return { needsVerification: !data.session }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
    profile.value = null
  }

  async function requestPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) throw error
  }

  async function updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  async function resendVerification(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
  }

  async function updateProfile(
    patch: Partial<
      Pick<
        Profile,
        | 'display_name'
        | 'timezone'
        | 'notify_in_app'
        | 'notify_push'
        | 'airing_digest_hour'
        | 'avatar_url'
      >
    >,
  ): Promise<void> {
    if (!user.value) throw new Error('not signed in')
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.value.id)
      .select('*')
      .single()
    if (error) throw error
    profile.value = data as Profile
  }

  return {
    session,
    profile,
    ready,
    user,
    isAuthenticated,
    isEmailVerified,
    isAdmin,
    timezone,
    init,
    loadProfile,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    resendVerification,
    updateProfile,
  }
})
