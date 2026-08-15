"use client";

import { Download, RefreshCw, CheckCircle2, AlertCircle, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppUpdater } from "@/hooks/use-app-updater";

/** Only rendered inside the Electron desktop shell — the web deployment has no installer to update. */
export function UpdatePanel() {
  const updater = useAppUpdater();

  if (!updater.available) return null;

  const { status } = updater;

  return (
    <div className="glass-panel flex items-center justify-between gap-4 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orion-cyan/10">
          {status.state === "checking" || status.state === "downloading" ? (
            <Loader2 className="h-4 w-4 animate-spin text-orion-cyan" />
          ) : status.state === "ready" ? (
            <CheckCircle2 className="h-4 w-4 text-orion-success" />
          ) : status.state === "error" ? (
            <AlertCircle className="h-4 w-4 text-orion-danger" />
          ) : (
            <Download className="h-4 w-4 text-orion-cyan" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">
            ORION {updater.currentVersion ? `v${updater.currentVersion}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {status.state === "idle" && "Checking for updates automatically in the background."}
            {status.state === "checking" && "Checking for updates…"}
            {status.state === "up-to-date" && "You're on the latest version."}
            {status.state === "available" && `Update v${status.version} found — downloading…`}
            {status.state === "downloading" && `Downloading update… ${status.percent}%`}
            {status.state === "ready" && `v${status.version} downloaded — restart to install.`}
            {status.state === "error" && status.message}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {status.state === "ready" ? (
          <Button size="sm" onClick={updater.restartAndInstall} className="gap-1.5 bg-orion-cyan text-orion-cyan-foreground hover:bg-orion-cyan/90">
            <RotateCw className="h-3.5 w-3.5" />
            Restart & install
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={updater.checkNow}
            disabled={status.state === "checking" || status.state === "downloading"}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Check now
          </Button>
        )}
        {status.state === "up-to-date" && (
          <Badge variant="secondary" className="bg-orion-success/15 text-[10px] text-orion-success">
            Up to date
          </Badge>
        )}
      </div>
    </div>
  );
}
