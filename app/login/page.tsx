"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
                <p className="text-xs text-[#555] mt-1">We&apos;ll email you a link — no password needed</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email" autoFocus value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#555] transition-colors"
                />
                {error && <p className="text-xs text-[#f55]">{error}</p>}
                <button type="submit" disabled={loading || !email.trim()}
                  className="w-full h-11 rounded-xl bg-[#111] border border-[#333] text-sm font-semibold hover:bg-[#1a1a1a] transition-colors disabled:opacity-40">
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
