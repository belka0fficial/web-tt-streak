"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("code");
    if (code) {
      getSupabase().auth.exchangeCodeForSession(code).then(({ error }) => {
        router.replace(error ? "/login" : "/");
      });
    } else {
      router.replace("/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center">
        <Flame className="w-5 h-5 text-white" />
      </div>
      <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
