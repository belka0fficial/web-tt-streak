"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Flame } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

const VIEWPORT = { width: 480, height: 640 };

export default function TikTokBrowserPage() {
  const [token,  setToken]  = useState("");
  const [phase,  setPhase]  = useState<"starting" | "ready" | "done" | "error">("starting");
  const [imgSrc, setImgSrc] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const blobRef = useRef("");

  // Get token from Supabase localStorage session
  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.close(); return; }
      setToken(session.access_token);
    });
  }, []);

  // Start Playwright, then begin streaming
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch("/api/auth/start", { method: "POST", headers })
      .then(() => setPhase("ready"))
      .catch(() => setPhase("error"));

    // Screenshot refresh
    const screenshotLoop = setInterval(async () => {
      const r = await fetch(`/api/auth/qr?t=${Date.now()}`, { headers }).catch(() => null);
      if (!r?.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      blobRef.current = url;
      setImgSrc(url);
    }, 300);

    // Poll for login completion
    const statusLoop = setInterval(async () => {
      const r = await fetch("/api/auth/status", { headers }).catch(() => null);
      if (!r?.ok) return;
      const d = await r.json();
      if (d.phase === "done") {
        clearInterval(statusLoop);
        clearInterval(screenshotLoop);
        setPhase("done");
        window.opener?.postMessage("tiktok-connected", "*");
        setTimeout(() => window.close(), 1200);
      } else if (d.phase === "error") {
        clearInterval(statusLoop);
        clearInterval(screenshotLoop);
        setPhase("error");
      }
    }, 2000);

    return () => { clearInterval(screenshotLoop); clearInterval(statusLoop); };
  }, [token]);

  // Forward clicks → Playwright
  const handleClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!token || !imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width)  * VIEWPORT.width);
    const y = Math.round(((e.clientY - r.top)  / r.height) * VIEWPORT.height);
    fetch("/api/auth/input", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "click", x, y }),
    });
  }, [token]);

  // Forward keyboard → Playwright
  useEffect(() => {
    if (!token || phase !== "ready") return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      fetch("/api/auth/input", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "key", key: e.key }),
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [token, phase]);

  // Forward scroll → Playwright
  const handleWheel = useCallback((e: React.WheelEvent<HTMLImageElement>) => {
    if (!token || !imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width)  * VIEWPORT.width);
    const y = Math.round(((e.clientY - r.top)  / r.height) * VIEWPORT.height);
    fetch("/api/auth/input", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "scroll", x, y, deltaY: e.deltaY }),
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#111] border border-[#222] flex items-center justify-center">
            <Flame className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium text-white">Connect TikTok</span>
        </div>
        <span className="text-xs text-[#444]">
          {phase === "starting" && "Starting…"}
          {phase === "ready"    && "Click to interact"}
          {phase === "done"     && "Connected ✓"}
          {phase === "error"    && "Error"}
        </span>
      </div>

      {/* Browser area */}
      <div className="flex-1 flex items-start justify-center bg-[#080808]">
        {phase === "starting" && (
          <div className="flex flex-col items-center gap-3 mt-20">
            <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-xs text-[#444]">Loading TikTok…</p>
          </div>
        )}

        {(phase === "ready" || phase === "done") && imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={imgSrc}
            alt="TikTok"
            onClick={handleClick}
            onWheel={handleWheel}
            className="w-full max-w-[480px] cursor-pointer select-none"
            style={{ imageRendering: "crisp-edges", display: "block" }}
            draggable={false}
          />
        )}

        {phase === "done" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <p className="text-[#3ecf8e] font-semibold text-lg">Connected! Closing…</p>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-3 mt-20">
            <p className="text-[#f55] text-sm">Something went wrong</p>
            <button onClick={() => window.close()}
              className="text-xs text-[#555] border border-[#222] rounded-lg px-4 py-2 hover:text-white transition-colors">
              Close
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
