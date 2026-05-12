import { createClient }
from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY

/* =====================================
   SINGLETON SUPABASE CLIENT
===================================== */

export const supabase =
  globalThis.__supabase ??
  createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  )

if (!globalThis.__supabase) {
  globalThis.__supabase = supabase
}