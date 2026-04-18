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
  id: number;
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

function LoginModal({ onClose, onSuccess, authFetch }: {
  onClose: () => void;
  onSuccess: () => void;
  authFetch: AuthFetch;
}) {
  const [phase,   setPhase]   = useState<"starting" | "enter_phone" | "enter_otp" | "done" | "error">("starting");
  const [phone,   setPhone]   = useState("");
  const [otp,     setOtp]     = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authFetch("/api/auth/start", { method: "POST" })
      .then(r => r.json())
      .then(d => setPhase(d.phase ?? "enter_phone"))
      .catch(() => { setError("Failed to start"); setPhase("error"); });

    const poll = setInterval(async () => {
      const res = await authFetch("/api/auth/status").catch(() => null);
      if (!res?.ok) return;
      const d = await res.json();
      if (d.phase === "done") {
        clearInterval(poll); setPhase("done");
        setTimeout(() => { onSuccess(); onClose(); }, 1000);
      } else if (d.phase === "error") {
        clearInterval(poll); setError(d.error ?? "Login failed"); setPhase("error");
      }
    }, 2000);

    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePhone(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await authFetch("/api/auth/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) setError(d?.error ?? "Failed to send code");
    else setPhase("enter_otp");
    setLoading(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl p-5 space-y-5">

        <div>
          <h2 className="text-base font-semibold">Connect TikTok</h2>
          <p className="text-xs text-[#555] mt-0.5">
            {phase === "enter_phone" && "Enter your TikTok phone number"}
            {phase === "enter_otp"   && "Enter the code TikTok sent you"}
            {phase === "starting"    && "Starting…"}
            {phase === "done"        && "Connected!"}
            {phase === "error"       && "Something went wrong"}
          </p>
        </div>

        {phase === "starting" && (
          <div className="flex justify-center py-6">
            <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {phase === "enter_phone" && (
          <form onSubmit={handlePhone} className="space-y-3">
            <input
              type="tel" autoFocus required value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+972 52 659 8196"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#333] focus:outline-none focus:border-[#555] transition-colors"
            />
            {error && <p className="text-xs text-[#f55]">{error}</p>}
            <button type="submit" disabled={loading || !phone.trim()}
              className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] disabled:opacity-40 transition-colors">
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        )}

        {phase === "enter_otp" && (
          <form onSubmit={handleOtp} className="space-y-3">
            <p className="text-xs text-[#555]">Sent to <span className="text-[#aaa]">{phone}</span></p>
            <input
              type="number" autoFocus required value={otp}
              onChange={e => setOtp(e.target.value)}
              placeholder="123456"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#333] focus:outline-none focus:border-[#555] transition-colors tracking-widest"
            />
            {error && <p className="text-xs text-[#f55]">{error}</p>}
            <button type="submit" disabled={loading || otp.length < 4}
              className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] disabled:opacity-40 transition-colors">
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button type="button" onClick={() => { setPhase("enter_phone"); setOtp(""); setError(""); }}
              className="w-full h-10 text-xs text-[#555] hover:text-white transition-colors">
              Wrong number? Go back
            </button>
          </form>
        )}

        {phase === "done" && (
          <div className="flex items-center justify-center gap-2 py-4">
            <CheckCircle2 className="w-5 h-5 text-[#3ecf8e]" />
            <p className="text-sm text-[#3ecf8e] font-medium">TikTok connected!</p>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-[#f55] flex-shrink-0" />
              <p className="text-xs text-[#f55]">{error || "Login failed"}</p>
            </div>
            <button onClick={() => { setPhase("starting"); setError(""); authFetch("/api/auth/start", { method: "POST" }).then(r => r.json()).then(d => setPhase(d.phase ?? "enter_phone")); }}
              className="w-full h-10 rounded-xl border border-[#222] text-sm text-[#555] hover:text-white transition-colors">
              Try again
            </button>
          </div>
        )}

        {phase !== "done" && (
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
  const [msg,          setMsg]          = useState("🐿️🐿️🐿️");
  const [friends,      setFriends]      = useState<Friend[]>([]);

  // Status state (polled from API)
  const [sessionOk, setSessionOk] = useState(false);
  const [log,       setLog]       = useState<LogEntry[]>([]);
  const [running,   setRunning]   = useState(false);

  // UI state
  const [timePickerOpen,  setTimePickerOpen]  = useState(false);
  const [loginModalOpen,  setLoginModalOpen]  = useState(false);
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
    }).then(r => {
      if (r.status === 401) { window.location.href = "/login"; throw new Error("401"); }
      return r;
    });
  }, [session]);

  async function loadStatus() {
    const res = await authFetch("/api/status").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setSessionOk(data.sessionOk);
    setLog(data.logs ?? []);
    setRunning(data.status === "running");
    if (!initializedRef.current) {
      initializedRef.current = true;
      setScheduleOn(data.settings.schedule.enabled);
      setScheduleTime(data.settings.schedule.time);
      setFriends(data.settings.friends);
      setMsg(data.settings.message);
    }
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((event, s) => {
      if (s) {
        setSession(s);
        if (code) window.history.replaceState(null, "", "/");
      } else if (event === "INITIAL_SESSION" && !code) {
        window.location.href = "/login";
      } else if (event === "SIGNED_OUT") {
        window.location.href = "/login";
      }
    });

    if (code) {
      getSupabase().auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) window.location.href = "/login";
      });
    }

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
    await authFetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(console.error);
  }

  async function handleScheduleToggle(on: boolean) {
    setScheduleOn(on);
    await patch({ schedule: { enabled: on, time: scheduleTime } });
  }

  async function handleTimeChange(time: string) {
    setScheduleTime(time);
    await patch({ schedule: { enabled: scheduleOn, time } });
  }

  async function saveFriends(list: Friend[]) {
    setFriends(list);
    await patch({ friends: list });
  }

  function toggleFriend(id: number) {
    const updated = friends.map(f => f.id === id ? { ...f, active: !f.active } : f);
    saveFriends(updated);
  }

  function deleteFriend(id: number) {
    saveFriends(friends.filter(f => f.id !== id));
  }

  function commitAdd() {
    if (!newName.trim()) return;
    const updated: Friend[] = [...friends, {
      id: Date.now(),
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
      {loginModalOpen && (
        <LoginModal
          onClose={() => setLoginModalOpen(false)}
          onSuccess={() => { setSessionOk(true); loadStatus(); }}
          authFetch={authFetch}
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
            onClick={() => setLoginModalOpen(true)}
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
          <div className="px-4 py-3.5">
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onBlur={() => patch({ message: msg })}
              rows={3}
              className="w-full bg-transparent text-sm text-[#bbb] placeholder:text-[#333] resize-none focus:outline-none leading-relaxed"
              placeholder="Enter your streak message…"
            />
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
