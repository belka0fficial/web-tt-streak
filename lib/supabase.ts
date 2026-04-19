import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — only created on first use, never at module import time
let _browser: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_browser) {
    _browser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: 'implicit' } }
    );
  }
  return _browser;
}

// Server client — force no-store so Next.js 14 never caches Supabase responses
// Retries on ECONNRESET (Railway ↔ Supabase TLS drops under Playwright load)
export function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
          let lastErr: unknown;
          for (let i = 0; i < 3; i++) {
            try {
              return await fetch(url, { ...init, cache: 'no-store' });
            } catch (e) {
              lastErr = e;
              if (i < 2) await new Promise(r => setTimeout(r, 600 * (i + 1)));
            }
          }
          throw lastErr;
        },
      },
    }
  );
}
