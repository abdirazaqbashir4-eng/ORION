"use client";

import { useEffect, useState } from "react";
import type { SystemStats } from "@/types/electron";

/** Real CPU/RAM telemetry when running in the Electron desktop shell; null on web (no fake numbers). */
export function useSystemStats(): SystemStats | null {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.orion?.systemStats) return;

    let cancelled = false;
    window.orion.systemStats.get().then((initial) => {
      if (!cancelled) setStats(initial);
    });

    const unsubscribe = window.orion.systemStats.subscribe((next) => {
      if (!cancelled) setStats(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return stats;
}
