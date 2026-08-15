"use client";

import { useCallback, useEffect, useState } from "react";
import type { UpdaterStatus } from "@/types/electron";

/** Wraps window.orion.updater — null outside the Electron desktop shell (e.g. the web/Vercel deployment). */
export function useAppUpdater() {
  const [status, setStatus] = useState<UpdaterStatus>({ state: "idle" });
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const available = typeof window !== "undefined" && Boolean(window.orion?.updater);

  useEffect(() => {
    if (!available) return;

    let cancelled = false;
    window.orion!.updater.getStatus().then((initial) => {
      if (!cancelled) setStatus(initial);
    });
    window.orion!.updater.getCurrentVersion().then((version) => {
      if (!cancelled) setCurrentVersion(version);
    });

    const unsubscribe = window.orion!.updater.subscribe((next) => {
      if (!cancelled) setStatus(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [available]);

  const checkNow = useCallback(() => {
    void window.orion?.updater.check();
  }, []);

  const restartAndInstall = useCallback(() => {
    void window.orion?.updater.quitAndInstall();
  }, []);

  return { available, status, currentVersion, checkNow, restartAndInstall };
}
