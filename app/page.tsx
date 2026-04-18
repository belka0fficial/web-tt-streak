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
  const [phase, setPhase] = useState<"starting" | "waiting" | "done" | "error">("starting");
  const [error, setError] = useState("");
  const [tick, setTick]   = useState(0); // bumped to refresh screenshot

  useEffect(() => {
    authFetch("/api/auth/start", { method: "POST" })
      .then(r => r.ok ? setPhase("waiting") : Promise.reject())
      .catch(() => { setError("Failed to start login"); setPhase("error"); });

    // refresh screenshot every 1.5 s
    const imgRefresh = setInterval(() => setTick(t => t + 1), 1500);

    // poll completion every 2 s
    const statusPoll = setInterval(async () => {
      const res = await authFetch("/api/auth/status").catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      if (data.status === "done") {
        clearInterval(statusPoll); clearInterval(imgRefresh);
        setPhase("done");
        setTimeout(() => { onSuccess(); onClose(); }, 1000);
      } else if (data.status === "error") {
        clearInterval(statusPoll); clearInterval(imgRefresh);
        setError(data.error ?? "Login failed");
        setPhase("error");
      }
    }, 2000);

    return () => { clearInterval(statusPoll); clearInterval(imgRefresh); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80"
        onClick={phase === "waiting" ? undefined : onClose}
      />
      <div className="relative w-full max-w-sm bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl overflow-hidden">

        {/* header */}
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-base font-semibold">Connect TikTok</h2>
          <p className="text-xs text-[#555] mt-0.5">Scan the QR code with TikTok on your phone</p>
        </div>

        {/* live screenshot area */}
        {phase === "starting" && (
          <div className="flex items-center justify-center h-64 bg-[#080808]">
            <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {phase === "waiting" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tick}
            src={`/api/auth/qr?t=${tick}`}
            alt="TikTok login"
            className="w-full block"
            style={{ imageRendering: "crisp-edges" }}
          />
        )}

        {phase === "done" && (
          <div className="flex items-center justify-center gap-3 h-32 bg-[#080808]">
            <CheckCircle2 className="w-5 h-5 text-[#3ecf8e]" />
            <p className="text-sm text-[#3ecf8e]">Connected!</p>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-2 h-32 justify-center bg-[#080808] px-5">
            <XCircle className="w-5 h-5 text-[#f55]" />
            <p className="text-sm text-[#f55] text-center">{error || "Login failed"}</p>
          </div>
        )}

        {/* footer */}
        {(phase === "waiting" || phase === "error") && (
          <div className="p-4">
            <button onClick={onClose}
              className="w-full h-11 rounded-xl border border-[#222] text-sm text-[#555] hover:text-white transition-colors">
              Cancel
            </button>
          </div>
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
    if (code) {
      getSupabase().auth.exchangeCodeForSession(code).then(({ data: { session } }) => {
        if (session) window.location.replace("/");
        else window.location.replace("/login");
      });
      return;
    }
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return; }
      setSession(session);
    });
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_, s) => {
      if (!s) { window.location.href = "/login"; return; }
      setSession(s);
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
