"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

const LIMIT_MS = 15 * 60 * 1000;

/** Signs you out after 15 minutes without touching the app, so a phone left unlocked does not expose your data. */
export function IdleLock() {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    let done = false;

    const lock = async () => {
      if (done) return;
      done = true;
      await getSupabase().auth.signOut();
      router.replace("/login");
      router.refresh();
    };
    const touch = () => {
      last = Date.now();
    };
    const check = () => {
      if (Date.now() - last > LIMIT_MS) void lock();
    };

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(check, 30_000);
    // Coming back to the tab or phone after a long time counts as idle too.
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
