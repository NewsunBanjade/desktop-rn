import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  publishableKey: string
}

export function getSavedConfig(): SupabaseConfig {
  let envUrl = ''
  let envPublishableKey = ''

  if (window.api && typeof window.api.getEnv === 'function') {
    try {
      const env = window.api.getEnv()
      envUrl = env.SUPABASE_URL || ''
      envPublishableKey = env.SUPABASE_PUBLISHABLE_KEY || ''
    } catch (e) {
      console.error('Failed to get env from main process:', e)
    }
  }

  const url =
    envUrl ||
    localStorage.getItem('rn_supabase_url') ||
    (import.meta.env.VITE_SUPABASE_URL as string) ||
    ''
  const publishableKey =
    envPublishableKey ||
    localStorage.getItem('rn_supabase_publishable_key') ||
    localStorage.getItem('rn_supabase_anon_key') ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
    ''
  return { url, publishableKey }
}

export function saveConfig(url: string, publishableKey: string): void {
  localStorage.setItem('rn_supabase_url', url.trim())
  localStorage.setItem('rn_supabase_publishable_key', publishableKey.trim())
  _supabaseInstance = null
}

export function clearConfig(): void {
  localStorage.removeItem('rn_supabase_url')
  localStorage.removeItem('rn_supabase_publishable_key')
  localStorage.removeItem('rn_supabase_anon_key')
  _supabaseInstance = null
}

let _supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (_supabaseInstance) return _supabaseInstance

  const { url, publishableKey } = getSavedConfig()
  if (!url || !publishableKey) return null

  try {
    // Basic validation of URL structure to avoid crash on createClient
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return null
    }
    _supabaseInstance = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false // Disable since we are in Electron desktop app
      }
    })
    return _supabaseInstance
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error)
    return null
  }
}
