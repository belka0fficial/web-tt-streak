"use client";

import { useState } from "react";
import { Flame, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

type Screen = "welcome" | "signup" | "signin" | "forgot" | "sent";

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

export default function LoginPage() {
  const [screen,   setScreen]   = useState<Screen>("welcome");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  function go(s: Screen) { setError(""); setScreen(s); }

  function callbackUrl() {
    return `${window.location.origin}/auth/callback`;
  }

  async function oAuth(provider: "google" | "github") {
    setError("");
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    });
    if (error) setError(error.message);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await getSupabase().auth.signUp({
      email, password,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) setError(error.message);
    else go("sent");
    setLoading(false);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else window.location.href = "/";
    setLoading(false);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) setError(error.message);
    else go("sent");
    setLoading(false);
  }

  const wrap = (children: React.ReactNode) => (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  );

  // ── Welcome ──────────────────────────────────────────────────────────────────
  if (screen === "welcome") return wrap(
    <div className="space-y-10 text-center">
      <div className="space-y-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-[#111] border border-[#222] flex items-center justify-center">
            <Flame className="w-7 h-7 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Streak Saver</h1>
          <p className="text-[#555] text-sm leading-relaxed max-w-[260px] mx-auto">
            Keep your TikTok streaks alive — automatically, every day.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button onClick={() => go("signup")}
          className="w-full h-12 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] transition-colors">
          Get started
        </button>
        <button onClick={() => go("signin")}
          className="w-full h-12 rounded-xl border border-[#222] text-sm font-medium text-[#888] hover:text-white hover:border-[#444] transition-colors">
          Sign in
        </button>
      </div>
    </div>
  );

  // ── Sent / check email ────────────────────────────────────────────────────────
  if (screen === "sent") return wrap(
    <div className="space-y-8 text-center">
      <div className="space-y-3">
        <div className="text-4xl">✉️</div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-[#555] leading-relaxed">
          We sent a link to <span className="text-[#aaa]">{email}</span>.
          <br />Click it to continue.
        </p>
      </div>
      <button onClick={() => go("signin")}
        className="w-full h-11 rounded-xl border border-[#222] text-sm text-[#666] hover:text-white hover:border-[#444] transition-colors">
        Back to sign in
      </button>
    </div>
  );

  // ── Shared signup / signin / forgot ──────────────────────────────────────────
  const isSignup = screen === "signup";
  const isForgot = screen === "forgot";

  return wrap(
    <div className="space-y-6">

      {/* Back */}
      <button onClick={() => go(isForgot ? "signin" : "welcome")}
        className="flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors -ml-0.5">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold">
          {isSignup ? "Create account" : isForgot ? "Reset password" : "Welcome back"}
        </h1>
        <p className="text-sm text-[#555]">
          {isSignup
            ? "Start saving your streaks today"
            : isForgot
            ? "Enter your email and we'll send a reset link"
            : "Sign in to your account"}
        </p>
      </div>

      {/* OAuth buttons — not on forgot screen */}
      {!isForgot && (
        <div className="space-y-2.5">
          <button onClick={() => oAuth("google")}
            className="w-full h-11 rounded-xl bg-[#111] border border-[#2a2a2a] text-sm font-medium hover:bg-[#1a1a1a] hover:border-[#444] transition-colors flex items-center justify-center gap-2.5">
            <GoogleIcon />
            Continue with Google
          </button>
          <button onClick={() => oAuth("github")}
            className="w-full h-11 rounded-xl bg-[#111] border border-[#2a2a2a] text-sm font-medium hover:bg-[#1a1a1a] hover:border-[#444] transition-colors flex items-center justify-center gap-2.5">
            <GitHubIcon />
            Continue with GitHub
          </button>
        </div>
      )}

      {!isForgot && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#1e1e1e]" />
          <span className="text-xs text-[#333]">or</span>
          <div className="flex-1 h-px bg-[#1e1e1e]" />
        </div>
      )}

      {/* Form */}
      <form onSubmit={isSignup ? handleSignUp : isForgot ? handleForgot : handleSignIn} className="space-y-3">

        <div className="space-y-2">
          <label className="text-xs text-[#555] font-medium">Email</label>
          <input
            type="email" required autoFocus value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#333] focus:outline-none focus:border-[#555] transition-colors"
          />
        </div>

        {!isForgot && (
          <div className="space-y-2">
            <label className="text-xs text-[#555] font-medium">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"} required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isSignup ? "At least 6 characters" : "Your password"}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-[#333] focus:outline-none focus:border-[#555] transition-colors"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {!isSignup && !isForgot && (
          <div className="flex justify-end">
            <button type="button" onClick={() => go("forgot")}
              className="text-xs text-[#555] hover:text-[#888] transition-colors">
              Forgot password?
            </button>
          </div>
        )}

        {error && <p className="text-xs text-[#f55]">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] transition-colors disabled:opacity-40 mt-1">
          {loading ? "…" : isSignup ? "Create account" : isForgot ? "Send reset link" : "Sign in"}
        </button>
      </form>

      {/* Toggle signup / signin */}
      {!isForgot && (
        <p className="text-center text-xs text-[#555]">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <button onClick={() => go(isSignup ? "signin" : "signup")}
            className="text-[#888] hover:text-white transition-colors font-medium">
            {isSignup ? "Sign in" : "Get started"}
          </button>
        </p>
      )}
    </div>
  );
}
