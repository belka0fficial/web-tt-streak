import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — only created on first use, never at module import time
let _browser: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_browser) {
    _browser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _browser;
}

// Server client — new instance per call is fine (no persistent auth state needed)
export function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
