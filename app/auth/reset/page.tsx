"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Flame } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [done,      setDone]      = useState(false);
  const [ready,     setReady]     = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the reset link is clicked
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) setError(error.message);
    else setDone(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#111] border border-[#222] flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[15px] font-semibold">Streak Saver</span>
        </div>

        {done ? (
          <div className="space-y-4 text-center py-4">
            <p className="text-lg font-semibold">Password updated</p>
            <p className="text-sm text-[#555]">You can now sign in with your new password.</p>
            <a href="/login"
              className="block w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] transition-colors flex items-center justify-center">
              Go to sign in
            </a>
          </div>
        ) : !ready ? (
          <div className="text-center py-8 space-y-2">
            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin inline-block" />
            <p className="text-sm text-[#555]">Verifying reset link…</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold">Set new password</h1>
              <p className="text-sm text-[#555]">Choose a strong password for your account.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#555] font-medium">New password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"} required autoFocus
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-[#333] focus:outline-none focus:border-[#555] transition-colors"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-[#f55]">{error}</p>}

            <button type="submit" disabled={loading || password.length < 6}
              className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] transition-colors disabled:opacity-40">
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
