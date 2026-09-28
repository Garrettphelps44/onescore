import { createClient } from '@supabase/supabase-js'

// Browser code gets the URL and anon key only (Secret Lock).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill both in.')
}

export const supabase = createClient(url, anonKey)
