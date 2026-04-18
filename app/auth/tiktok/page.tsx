"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

const VIEWPORT = { width: 390, height: 844 };

export default function TikTokBrowserPage() {
  const [token,  setToken]  = useState("");
  const [phase,  setPhase]  = useState<"starting" | "ready" | "done" | "error">("starting");
  const [imgSrc, setImgSrc] = useState("");
  const imgRef  = useRef<HTMLImageElement>(null);
  const blobRef = useRef("");

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.close(); return; }
      setToken(session.access_token);
    });
  }, []);

  const fetchScreenshot = useCallback(async (headers: HeadersInit) => {
    const r = await fetch(`/api/auth/qr?t=${Date.now()}`, { headers }).catch(() => null);
    if (r?.ok) {
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      blobRef.current = url;
      setImgSrc(url);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch("/api/auth/start", { method: "POST", headers })
      .then(() => setPhase("ready"))
      .catch(() => setPhase("error"));

    let running = true;
    const screenshotLoop = async () => {
      while (running) {
        await fetchScreenshot(headers);
        await new Promise(res => setTimeout(res, 150));
      }
    };
    screenshotLoop();

    const statusLoop = setInterval(async () => {
      const r = await fetch("/api/auth/status", { headers }).catch(() => null);
      if (!r?.ok) return;
      const d = await r.json();
      if (d.phase === "done") {
        clearInterval(statusLoop);
        running = false;
        setPhase("done");
        window.opener?.postMessage("tiktok-connected", "*");
        setTimeout(() => window.close(), 800);
      } else if (d.phase === "error") {
        clearInterval(statusLoop);
        running = false;
        setPhase("error");
      }
    }, 2000);

    return () => { running = false; clearInterval(statusLoop); };
  }, [token, fetchScreenshot]);

  const sendClick = useCallback(async (clientX: number, clientY: number) => {
    if (!token || !imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    const x = Math.round(((clientX - r.left) / r.width)  * VIEWPORT.width);
    const y = Math.round(((clientY - r.top)  / r.height) * VIEWPORT.height);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await fetch("/api/auth/input", {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "click", x, y }),
    });
    // Immediately grab a fresh screenshot so the click feels instant
    await fetchScreenshot({ Authorization: `Bearer ${token}` });
  }, [token, fetchScreenshot]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    sendClick(e.clientX, e.clientY);
  }, [sendClick]);

  const handleTouch = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    sendClick(t.clientX, t.clientY);
  }, [sendClick]);

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
    <div className="min-h-screen bg-black flex items-start justify-center">

      {/* Loading spinner — shown only before first screenshot arrives */}
      {phase === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-xs text-[#444]">Opening TikTok…</p>
        </div>
      )}

      {(phase === "ready" || phase === "done") && imgSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={imgSrc}
          alt=""
          onClick={handleClick}
          onTouchEnd={handleTouch}
          onWheel={handleWheel}
          className="w-full max-w-[480px] cursor-pointer select-none"
          style={{ imageRendering: "crisp-edges", display: "block", touchAction: "none" }}
          draggable={false}
        />
      )}

      {phase === "done" && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <p className="text-[#3ecf8e] font-semibold text-lg">Connected! Closing…</p>
        </div>
      )}

      {phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <p className="text-[#f55] text-sm">Something went wrong</p>
          <button onClick={() => window.close()}
            className="text-xs text-[#555] border border-[#222] rounded-lg px-4 py-2 hover:text-white transition-colors">
            Close
          </button>
        </div>
      )}

    </div>
  );
}
