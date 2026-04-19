"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import {
  Flame, Plus, Trash2, Play,
  CheckCircle2, XCircle,
  ChevronRight, Clock, Users, MessageSquare, LogIn,
} from "lucide-react";
import clsx from "clsx";

interface Friend {
  id: string;
  name: string;
  handle: string;
  active: boolean;
}

interface LogEntry {
  id: number;
  ts: number;
  ok: boolean;
  sent: number;
  total: number;
  detail?: string;
}

function fmtTs(ts: number) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en", { month: "short", day: "2-digit" }) +
    " · " +
    d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => set(!on)}
      className={clsx(
        "relative w-11 h-6 rounded-full flex-shrink-0 overflow-hidden transition-colors duration-200",
        on ? "bg-white" : "bg-[#2a2a2a]"
      )}
    >
      <span className={clsx(
        "absolute top-[3px] w-[18px] h-[18px] rounded-full shadow-sm transition-[left] duration-200",
        on ? "bg-black" : "bg-[#666]",
        on ? "left-[23px]" : "left-[3px]"
      )} />
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#555] transition-colors"
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#444] whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-[#1a1a1a]" />
    </div>
  );
}

// ── Time picker modal ─────────────────────────────────────────────────────────

function TimePickerModal({ time, onConfirm, onClose }: {
  time: string;
  onConfirm: (t: string) => void;
  onClose: () => void;
}) {
  const [h, m] = time.split(":").map(Number);
  const [hour,   setHour]   = useState(h);
  const [minute, setMinute] = useState(m);

  const hPct = (hour   / 23) * 100;
  const mPct = (minute / 59) * 100;

  function confirm() {
    onConfirm(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl p-6 space-y-7">
        <div className="text-center pt-1">
          <p className="text-[56px] font-bold tabular-nums tracking-tight leading-none">
            {String(hour).padStart(2, "0")}
            <span className="text-[#333] mx-1">:</span>
            {String(minute).padStart(2, "0")}
          </p>
          <p className="text-xs text-[#444] mt-2">Drag to set your daily send time</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#666] uppercase tracking-widest">Hour</span>
            <span className="text-sm font-semibold tabular-nums text-white w-8 text-right">
              {String(hour).padStart(2, "0")}
            </span>
          </div>
          <input
            type="range" min={0} max={23} value={hour}
            onChange={e => setHour(+e.target.value)}
            className="slider"
            style={{ background: `linear-gradient(to right, #fff ${hPct}%, #222 ${hPct}%)` }}
          />
          <div className="flex justify-between text-[10px] text-[#333] tabular-nums">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#666] uppercase tracking-widest">Minute</span>
            <span className="text-sm font-semibold tabular-nums text-white w-8 text-right">
              {String(minute).padStart(2, "0")}
            </span>
          </div>
          <input
            type="range" min={0} max={59} value={minute}
            onChange={e => setMinute(+e.target.value)}
            className="slider"
            style={{ background: `linear-gradient(to right, #fff ${mPct}%, #222 ${mPct}%)` }}
          />
          <div className="flex justify-between text-[10px] text-[#333] tabular-nums">
            <span>00</span><span>15</span><span>30</span><span>45</span><span>59</span>
          </div>
        </div>

        <div className="flex gap-2.5 pt-1">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-[#222] text-sm text-[#555] hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={confirm}
            className="flex-1 h-11 rounded-xl bg-[#111] border border-[#333] text-sm font-semibold text-white hover:bg-[#1a1a1a] transition-colors">
            Set time
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Login modal ───────────────────────────────────────────────────────────────

type AuthFetch = (url: string, opts?: RequestInit) => Promise<Response>;

// Common country codes — extend as needed
const COUNTRY_CODES = [
  { code: "+1",   flag: "🇺🇸", label: "US/CA" },
  { code: "+44",  flag: "🇬🇧", label: "UK" },
  { code: "+49",  flag: "🇩🇪", label: "DE" },
  { code: "+33",  flag: "🇫🇷", label: "FR" },
  { code: "+7",   flag: "🇷🇺", label: "RU" },
  { code: "+972", flag: "🇮🇱", label: "IL" },
  { code: "+380", flag: "🇺🇦", label: "UA" },
  { code: "+90",  flag: "🇹🇷", label: "TR" },
  { code: "+91",  flag: "🇮🇳", label: "IN" },
  { code: "+86",  flag: "🇨🇳", label: "CN" },
  { code: "+81",  flag: "🇯🇵", label: "JP" },
  { code: "+82",  flag: "🇰🇷", label: "KR" },
  { code: "+55",  flag: "🇧🇷", label: "BR" },
  { code: "+52",  flag: "🇲🇽", label: "MX" },
  { code: "+34",  flag: "🇪🇸", label: "ES" },
  { code: "+39",  flag: "🇮🇹", label: "IT" },
  { code: "+31",  flag: "🇳🇱", label: "NL" },
  { code: "+48",  flag: "🇵🇱", label: "PL" },
  { code: "+20",  flag: "🇪🇬", label: "EG" },
  { code: "+966", flag: "🇸🇦", label: "SA" },
];

type ModalMode = "pick" | "creds" | "qr" | "session" | "otp" | "waiting" | "done" | "error";

function LoginModal({ onClose, onSuccess, authFetch }: {
  onClose: () => void;
  onSuccess: () => void;
  authFetch: AuthFetch;
}) {
  const [mode,      setMode]      = useState<ModalMode>("pick");
  const [country,   setCountry]   = useState("+1");
  const [localNum,  setLocalNum]  = useState("");
  const [password,  setPassword]  = useState("");
  const [otp,       setOtp]       = useState("");
  const [sessionId, setSessionId] = useState("");
  const [qrSrc,     setQrSrc]     = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrBlobRef = useRef("");

  const fullPhone = `${country}${localNum}`;

  function stopPolling() { if (pollRef.current) clearInterval(pollRef.current); }
  useEffect(() => stopPolling, []);

  function startStatusPolling() {
    pollRef.current = setInterval(async () => {
      const res = await authFetch("/api/auth/status").catch(() => null);
      if (!res?.ok) return;
      const d = await res.json();
      if (d.phase === "done") {
        stopPolling();
        setMode("done");
        setTimeout(() => { onSuccess(); onClose(); }, 1000);
      } else if (d.phase === "error") {
        stopPolling();
        setError(d.error ?? "Login failed");
        setMode("error");
      } else if (d.phase === "enter_otp") {
        setMode("otp");
      }
    }, 2000);
  }

  // QR screenshot loop
  useEffect(() => {
    if (mode !== "qr") return;
    let running = true;
    (async () => {
      while (running) {
        const r = await authFetch(`/api/auth/qr?t=${Date.now()}`).catch(() => null);
        if (r?.ok) {
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          if (qrBlobRef.current) URL.revokeObjectURL(qrBlobRef.current);
          qrBlobRef.current = url;
          setQrSrc(url);
        }
        await new Promise(res => setTimeout(res, 1500));
      }
    })();
    return () => { running = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await authFetch("/api/auth/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: fullPhone, password }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) { setError(d?.error ?? "Failed"); setLoading(false); return; }
    setLoading(false);
    setMode("waiting");
    startStatusPolling();
  }

  async function handleQR() {
    setError(""); setLoading(true);
    const res = await authFetch("/api/auth/qr-start", { method: "POST" }).catch(() => null);
    if (!res?.ok) { setError("Failed to start"); setLoading(false); return; }
    setLoading(false);
    setMode("qr");
    startStatusPolling();
  }

  async function handleSessionId(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await authFetch("/api/auth/session-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) { setError(d?.error ?? "Invalid"); setLoading(false); return; }
    setLoading(false);
    setMode("done");
    setTimeout(() => { onSuccess(); onClose(); }, 1000);
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await authFetch("/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) setError(d?.error ?? "Invalid code");
    setLoading(false);
  }

  function openBrowserPopup() {
    window.open("/auth/tiktok", "_blank", "width=430,height=900");
    const handler = (e: MessageEvent) => {
      if (e.data === "tiktok-connected") {
        window.removeEventListener("message", handler);
        onSuccess(); onClose();
      }
    };
    window.addEventListener("message", handler);
    onClose();
  }

  function back() { stopPolling(); setMode("pick"); setError(""); setQrSrc(""); }

  const inputCls = "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#333] focus:outline-none focus:border-[#555] transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl p-5 space-y-5">

        <div>
          <h2 className="text-base font-semibold">Connect TikTok</h2>
          <p className="text-xs text-[#555] mt-0.5">
            {mode === "pick"    && "Choose how to log in"}
            {mode === "creds"   && "Enter your TikTok credentials"}
            {mode === "qr"      && "Scan with the TikTok app"}
            {mode === "session" && "Paste your session cookie"}
            {mode === "waiting" && "Logging in…"}
            {mode === "otp"     && "TikTok sent you a verification code"}
            {mode === "done"    && "Connected!"}
            {mode === "error"   && "Something went wrong"}
          </p>
        </div>

        {/* ── Pick method ── */}
        {mode === "pick" && (
          <div className="space-y-2">
            {[
              { icon: "🔑", title: "Phone + password", sub: "Logs in silently in the background", action: () => setMode("creds") },
              { icon: "🍪", title: "Paste cookie header", sub: "Copy Cookie: header from browser DevTools", action: () => setMode("session") },
            ].map(({ icon, title, sub, action }) => (
              <button key={title} onClick={action} disabled={loading}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] hover:border-[#444] transition-colors text-left disabled:opacity-40">
                <span className="text-xl w-7 text-center flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-[#555] mt-0.5">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── QR code ── */}
        {mode === "qr" && (
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden bg-[#0a0a0a] border border-[#2a2a2a] aspect-square flex items-center justify-center">
              {qrSrc
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={qrSrc} alt="TikTok QR" className="w-full h-full object-contain" />
                : <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              }
            </div>
            <p className="text-xs text-[#555] text-center">Open TikTok app → Profile → ☰ → QR code → Scan</p>
            <button onClick={back} className="w-full h-10 text-xs text-[#555] hover:text-white transition-colors">Back</button>
          </div>
        )}

        {/* ── Credentials ── */}
        {mode === "creds" && (
          <form onSubmit={handleCredentials} className="space-y-3">
            {/* Country + number row */}
            <div className="flex gap-2">
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-2.5 text-sm text-white focus:outline-none focus:border-[#555] transition-colors flex-shrink-0"
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                autoFocus
                required
                value={localNum}
                onChange={e => setLocalNum(e.target.value.replace(/\D/g, ""))}
                placeholder="5261234567"
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-[#444]">Digits only — e.g. 5261234567 (no spaces or dashes)</p>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className={inputCls}
            />
            {error && <p className="text-xs text-[#f55]">{error}</p>}
            <button type="submit" disabled={loading || localNum.length < 6 || !password.trim()}
              className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] disabled:opacity-40 transition-colors">
              {loading ? "Starting…" : "Log in"}
            </button>
            <button type="button" onClick={back} className="w-full h-10 text-xs text-[#555] hover:text-white transition-colors">Back</button>
          </form>
        )}

        {/* ── Session ID ── */}
        {mode === "session" && (
          <form onSubmit={handleSessionId} className="space-y-3">
            <div className="rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] p-3 space-y-1">
              <p className="text-xs font-medium text-[#888]">Copy all cookies (required for DMs):</p>
              <ol className="text-xs text-[#555] space-y-0.5 list-decimal list-inside">
                <li>Open TikTok in Chrome — make sure you&apos;re logged in</li>
                <li>Press <span className="text-[#888]">F12</span> → <span className="text-[#888]">Network</span> tab</li>
                <li>Reload the page, click any request to <span className="text-[#888] font-mono">tiktok.com</span></li>
                <li>In <span className="text-[#888]">Request Headers</span> find <span className="text-[#888] font-mono">cookie:</span></li>
                <li>Right-click the value → <span className="text-[#888]">Copy value</span> — paste it below</li>
              </ol>
            </div>
            <textarea
              autoFocus required
              rows={3}
              value={sessionId}
              onChange={e => setSessionId(e.target.value.trim())}
              placeholder="sessionid=abc; ttwid=xyz; tt_csrf_token=…"
              className={inputCls + " font-mono text-[11px] resize-none"}
            />
            {error && <p className="text-xs text-[#f55]">{error}</p>}
            <button type="submit" disabled={loading || !sessionId.includes('=')}
              className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] disabled:opacity-40 transition-colors">
              {loading ? "Saving…" : "Connect"}
            </button>
            <button type="button" onClick={back} className="w-full h-10 text-xs text-[#555] hover:text-white transition-colors">Back</button>
          </form>
        )}

        {/* ── Waiting ── */}
        {mode === "waiting" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-xs text-[#555]">Logging in to TikTok…</p>
          </div>
        )}

        {/* ── OTP ── */}
        {mode === "otp" && (
          <form onSubmit={handleOtp} className="space-y-3">
            <p className="text-xs text-[#555]">TikTok sent a code to <span className="text-[#aaa]">{fullPhone}</span></p>
            <input
              autoFocus required
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              maxLength={6}
              className={inputCls + " tracking-widest text-center text-lg"}
            />
            {error && <p className="text-xs text-[#f55]">{error}</p>}
            <button type="submit" disabled={loading || otp.length < 4}
              className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] disabled:opacity-40 transition-colors">
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        {/* ── Done ── */}
        {mode === "done" && (
          <div className="flex items-center justify-center gap-2 py-4">
            <CheckCircle2 className="w-5 h-5 text-[#3ecf8e]" />
            <p className="text-sm text-[#3ecf8e] font-medium">TikTok connected!</p>
          </div>
        )}

        {/* ── Error ── */}
        {mode === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-[#f55] flex-shrink-0" />
              <p className="text-xs text-[#f55]">{error || "Login failed"}</p>
            </div>
            <button onClick={back}
              className="w-full h-10 rounded-xl border border-[#222] text-sm text-[#555] hover:text-white transition-colors">
              Try again
            </button>
          </div>
        )}

        {mode !== "done" && mode !== "waiting" && mode !== "qr" && (
          <button onClick={onClose}
            className="w-full h-10 rounded-xl border border-[#1a1a1a] text-xs text-[#444] hover:text-[#888] transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Page() {
  // Settings state (hydrated from API on first load)
  const [scheduleOn,   setScheduleOn]   = useState(false);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [timezone,     setTimezone]     = useState("UTC");
  const [msg,          setMsg]          = useState("🐿️🐿️🐿️");
  const [friends,      setFriends]      = useState<Friend[]>([]);

  // Status state (polled from API)
  const [sessionOk, setSessionOk] = useState(false);
  const [log,       setLog]       = useState<LogEntry[]>([]);
  const [running,   setRunning]   = useState(false);

  // UI state
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [loginOpen,  setLoginOpen]  = useState(false);
  const [adding,    setAdding]    = useState(false);
  const [newName,   setNewName]   = useState("");
  const [newHandle, setNewHandle] = useState("");

  const [session, setSession]   = useState<Session | null>(null);
  const initializedRef           = useRef(false);

  const authFetch = useCallback((url: string, opts?: RequestInit) => {
    const token = session?.access_token ?? "";
    return fetch(url, {
      ...opts,
      headers: { ...opts?.headers, Authorization: `Bearer ${token}` },
    });
  }, [session]);

  async function loadStatus() {
    const res = await authFetch("/api/status").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setSessionOk(data.sessionOk);
    setLog(data.logs ?? []);
    setRunning(data.status === "running");
    if (!initializedRef.current && data.settings) {
      initializedRef.current = true;
      setScheduleOn(data.settings.schedule?.enabled ?? false);
      setScheduleTime(data.settings.schedule?.time ?? "09:00");
      setFriends(data.settings.friends ?? []);
      setMsg(data.settings.message ?? "🐿️🐿️🐿️");
      // Detect browser timezone and save if it differs from what's stored
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(detected);
      if (detected && detected !== (data.settings.timezone ?? "UTC")) {
        patch({ timezone: detected });
      }
    }
  }

  useEffect(() => {
    const hasHashToken = window.location.hash.includes("access_token");

    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((event, s) => {
      if (s) {
        setSession(s);
      } else if (event === "SIGNED_OUT") {
        window.location.href = "/login";
      } else if (event === "INITIAL_SESSION" && !hasHashToken) {
        window.location.href = "/login";
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    loadStatus();
    const id = setInterval(loadStatus, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function patch(body: object) {
    const res = await authFetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch((e) => { console.error("[patch]", e); return null; });
    if (res && !res.ok) {
      const d = await res.json().catch(() => ({}));
      console.error("[patch] server error:", d.error ?? res.status);
    }
  }

  async function handleScheduleToggle(on: boolean) {
    setScheduleOn(on);
    await patch({ schedule: { enabled: on, time: scheduleTime }, timezone });
  }

  async function handleTimeChange(time: string) {
    setScheduleTime(time);
    await patch({ schedule: { enabled: scheduleOn, time }, timezone });
  }

  async function saveFriends(list: Friend[]) {
    setFriends(list);
    await patch({ friends: list });
  }

  function toggleFriend(id: string) {
    const updated = friends.map(f => f.id === id ? { ...f, active: !f.active } : f);
    saveFriends(updated);
  }

  function deleteFriend(id: string) {
    saveFriends(friends.filter(f => f.id !== id));
  }

  function commitAdd() {
    if (!newName.trim()) return;
    const updated: Friend[] = [...friends, {
      id: String(Date.now()),
      name: newName.trim(),
      handle: newHandle.trim() || `@${newName.trim().toLowerCase().replace(/\s+/g, "_")}`,
      active: true,
    }];
    saveFriends(updated);
    setNewName(""); setNewHandle(""); setAdding(false);
  }

  async function runNow() {
    setRunning(true);
    await authFetch("/api/run", { method: "POST" }).catch(console.error);
    setTimeout(loadStatus, 800);
  }

  const activeCount = friends.filter(f => f.active).length;
  const isHealthy   = scheduleOn && sessionOk;
  const lastRun     = log[0] ?? null;

  return (
    <div className="min-h-screen bg-black text-white">
      {timePickerOpen && (
        <TimePickerModal
          time={scheduleTime}
          onConfirm={handleTimeChange}
          onClose={() => setTimePickerOpen(false)}
        />
      )}
      {loginOpen && (
        <LoginModal
          authFetch={authFetch}
          onSuccess={() => { setSessionOk(true); loadStatus(); }}
          onClose={() => setLoginOpen(false)}
        />
      )}

      <div className="max-w-[480px] mx-auto px-5 pt-12 pb-24 space-y-4">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0">
              <Flame className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[15px] font-semibold">Streak Saver</span>
          </div>
          <div className={clsx(
            "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
            isHealthy
              ? "bg-[#0d2a1a] border-[#1a4a2a] text-[#3ecf8e]"
              : "bg-[#2a0d0d] border-[#4a1a1a] text-[#f55]"
          )}>
            <span className={clsx(
              "w-1.5 h-1.5 rounded-full",
              isHealthy ? "bg-[#3ecf8e]" : "bg-[#f55]"
            )} />
            {isHealthy ? "Running" : scheduleOn ? "Error" : "Paused"}
          </div>
        </div>

        {/* ── Status overview ─────────────────────────────────────────────── */}
        <section className="border border-[#1e1e1e] rounded-xl overflow-hidden">
          {/* Session row */}
          <button
            onClick={() => setLoginOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#1a1a1a] text-left hover:bg-[#0a0a0a] transition-colors"
          >
            <div className={clsx(
              "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
              sessionOk ? "bg-[#0d2a1a]" : "bg-[#1a1a1a]"
            )}>
              {sessionOk
                ? <CheckCircle2 className="w-3.5 h-3.5 text-[#3ecf8e]" />
                : <LogIn className="w-3.5 h-3.5 text-[#555]" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {sessionOk ? "TikTok session active" : "Not connected"}
              </p>
              <p className="text-xs text-[#555] mt-0.5">
                {sessionOk ? "Tap to reconnect" : "Tap to log in with TikTok"}
              </p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#333] flex-shrink-0" />
          </button>

          {/* Last / Next run */}
          <div className="grid grid-cols-2 divide-x divide-[#1a1a1a] bg-[#080808]">
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-[#444] mb-1">Last sent</p>
              <p className="text-sm font-medium">{lastRun ? fmtTs(lastRun.ts) : "—"}</p>
              <p className="text-[11px] text-[#555] mt-0.5">
                {lastRun ? `${lastRun.sent}/${lastRun.total} delivered` : "Never run"}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-[#444] mb-1">Next send</p>
              <p className={clsx("text-sm font-medium", isHealthy ? "text-white" : "text-[#444]")}>
                {isHealthy ? `${scheduleTime} daily` : "—"}
              </p>
              <p className="text-[11px] text-[#555] mt-0.5">
                {isHealthy
                  ? `${activeCount} friend${activeCount !== 1 ? "s" : ""}`
                  : scheduleOn ? "check session" : "schedule off"}
              </p>
            </div>
          </div>
        </section>

        {/* ── Setup ───────────────────────────────────────────────────────── */}
        <SectionLabel>Setup</SectionLabel>

        {/* Schedule */}
        <section className="border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#1a1a1a]">
            <div>
              <p className="text-sm font-medium">Auto-send daily</p>
              <p className="text-xs text-[#555] mt-0.5">Sends to all active friends automatically</p>
            </div>
            <Toggle on={scheduleOn} set={handleScheduleToggle} />
          </div>
          <button
            onClick={() => setTimePickerOpen(true)}
            disabled={!scheduleOn}
            className="w-full flex items-center justify-between px-4 py-3.5 group transition-colors hover:bg-[#0a0a0a] disabled:opacity-40"
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-3.5 h-3.5 text-[#444]" />
              <span className="text-sm text-[#888]">Send time</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tabular-nums">{scheduleTime}</span>
              <span className="text-[10px] text-[#444]">{timezone.replace(/_/g, " ")}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#333] group-hover:text-[#555] transition-colors" />
            </div>
          </button>
        </section>

        {/* Friends */}
        <section className="border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 bg-[#080808] border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-[#444]" />
              <span className="text-sm font-medium">Friends</span>
              <span className="text-xs text-[#555]">{activeCount} active</span>
            </div>
            <button
              onClick={() => setAdding(a => !a)}
              className="h-7 px-3 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#444] transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          {adding && (
            <div className="p-4 border-b border-[#1a1a1a] bg-[#080808] space-y-2">
              <Input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && commitAdd()} placeholder="Display name" />
              <Input value={newHandle} onChange={e => setNewHandle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && commitAdd()} placeholder="@tiktok_handle" />
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setAdding(false); setNewName(""); setNewHandle(""); }}
                  className="flex-1 h-9 rounded-lg border border-[#222] text-sm text-[#555] hover:text-white transition-colors">
                  Cancel
                </button>
                <button onClick={commitAdd}
                  className="flex-1 h-9 rounded-lg bg-[#111] border border-[#333] text-sm font-medium text-white hover:bg-[#1a1a1a] transition-colors">
                  Add friend
                </button>
              </div>
            </div>
          )}

          {friends.length === 0 && !adding && (
            <p className="text-center text-sm text-[#444] py-8">No friends added yet</p>
          )}

          <div className="divide-y divide-[#1a1a1a]">
            {friends.map(f => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#080808] transition-colors">
                <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#222] flex items-center justify-center text-xs font-bold text-[#666] flex-shrink-0">
                  {f.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx("text-sm font-medium truncate", f.active ? "text-white" : "text-[#444]")}>
                    {f.name}
                  </p>
                  <p className="text-xs text-[#444] truncate">{f.handle}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <Toggle on={f.active} set={() => toggleFriend(f.id)} />
                  <button onClick={() => deleteFriend(f.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[#333] hover:text-[#f55] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Message */}
        <section className="border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 bg-[#080808] border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-[#444]" />
              <span className="text-sm font-medium">Message</span>
            </div>
            <span className="text-xs text-[#444]">{msg.length} chars</span>
          </div>
          <div className="px-4 pt-3.5 pb-3">
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              rows={3}
              className="w-full bg-transparent text-sm text-[#bbb] placeholder:text-[#333] resize-none focus:outline-none leading-relaxed"
              placeholder="Enter your streak message…"
            />
          </div>
          <div className="px-4 pb-3.5">
            <button
              onClick={() => patch({ message: msg })}
              className="h-9 px-4 rounded-lg bg-[#111] border border-[#2a2a2a] text-xs font-medium text-white hover:bg-[#1a1a1a] hover:border-[#444] transition-colors"
            >
              Save message
            </button>
          </div>
        </section>

        {/* ── Run Now ─────────────────────────────────────────────────────── */}
        <button
          onClick={runNow}
          disabled={running}
          className="w-full h-12 rounded-xl bg-[#111] border border-[#2a2a2a] text-sm font-semibold text-white hover:bg-[#161616] hover:border-[#3a3a3a] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? (
            <>
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Sending messages…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" fill="currentColor" />
              Run Now — send to {activeCount} friend{activeCount !== 1 ? "s" : ""}
            </>
          )}
        </button>

        {/* ── History ─────────────────────────────────────────────────────── */}
        <SectionLabel>History</SectionLabel>

        <section className="border border-[#1e1e1e] rounded-xl overflow-hidden">
          {log.length === 0 ? (
            <p className="text-center text-sm text-[#444] py-8">No runs yet</p>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {log.map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3.5">
                  {e.ok
                    ? <CheckCircle2 className="w-4 h-4 text-[#3ecf8e] flex-shrink-0" />
                    : <XCircle      className="w-4 h-4 text-[#f55] flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#666]">{fmtTs(e.ts)}</p>
                    {e.detail && <p className="text-[11px] text-[#444] truncate mt-0.5">{e.detail}</p>}
                  </div>
                  <span className={clsx(
                    "text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0",
                    e.ok ? "bg-[#3ecf8e]/10 text-[#3ecf8e]" : "bg-[#f55]/10 text-[#f55]"
                  )}>
                    {e.sent}/{e.total} sent
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
