"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [gLoading, setGLoading] = useState(false);

  async function handleGoogle() {
    setError(""); setGLoading(true);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setGLoading(false); }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">

        <div className="flex items-center gap-2.5 justify-center pb-2">
          <div className="w-7 h-7 rounded-md bg-[#111] border border-[#222] flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[15px] font-semibold">Streak Saver</span>
        </div>

        <div className="border border-[#1e1e1e] rounded-xl p-5 space-y-4">
          {sent ? (
            <div className="py-4 text-center space-y-1">
              <p className="text-sm font-medium">Check your email</p>
              <p className="text-xs text-[#555]">We sent a magic link to <span className="text-[#aaa]">{email}</span></p>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-sm font-semibold">Sign in</h1>
                <p className="text-xs text-[#555] mt-1">No password needed</p>
              </div>

              {/* Google OAuth */}
              <button
                onClick={handleGoogle}
                disabled={gLoading}
                className="w-full h-11 rounded-xl bg-[#111] border border-[#333] text-sm font-semibold hover:bg-[#1a1a1a] transition-colors disabled:opacity-40 flex items-center justify-center gap-2.5"
              >
                {gLoading ? (
                  <span>Redirecting…</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#1e1e1e]" />
                <span className="text-xs text-[#444]">or</span>
                <div className="flex-1 h-px bg-[#1e1e1e]" />
              </div>

              {/* Email magic link */}
              <form onSubmit={handleEmail} className="space-y-3">
                <input
                  type="email" autoFocus value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#555] transition-colors"
                />
                {error && <p className="text-xs text-[#f55]">{error}</p>}
                <button type="submit" disabled={loading || !email.trim()}
                  className="w-full h-11 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] text-sm text-[#888] hover:bg-[#111] transition-colors disabled:opacity-40">
                  {loading ? "Sending…" : "Send magic link"}
                </button>
              </form>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
