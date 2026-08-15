"use client";

import { Mic, MicOff, Power, XCircle, AlertCircle, Loader2, Volume2, Ear } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWakeWordAssistant, type WakeWordAssistantStatus } from "@/hooks/use-wake-word-assistant";

const STATUS_COPY: Record<WakeWordAssistantStatus, string> = {
  disabled: "Wake word is off — the microphone is closed.",
  starting: "Starting on-device wake-word detection…",
  standby: 'Standing by — say "Hey Jarvis" (placeholder trigger; a custom "Hey ORION" model is a planned follow-up).',
  greeting: "Wake phrase detected — replying…",
  listening: "ORION is listening…",
  processing: "Captured — analyzing…",
  error: "Something went wrong.",
};

const STATUS_BADGE_CLASS: Record<WakeWordAssistantStatus, string> = {
  disabled: "bg-muted text-muted-foreground",
  starting: "bg-orion-violet/15 text-orion-violet",
  standby: "bg-orion-cyan/15 text-orion-cyan",
  greeting: "bg-orion-violet/15 text-orion-violet",
  listening: "bg-orion-success/15 text-orion-success",
  processing: "bg-orion-violet/15 text-orion-violet",
  error: "bg-orion-danger/15 text-orion-danger",
};

export function WakeWordPanel() {
  const wake = useWakeWordAssistant();

  // Mic is physically open (via the on-device wake engine or continuous
  // recognition) in every state except fully disabled or a hard error.
  const micOpen = wake.status !== "disabled" && wake.status !== "error";
  const isListeningTurn = wake.status === "listening" || wake.status === "greeting" || wake.status === "processing";

  return (
    <div className="glass-panel space-y-5 rounded-xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">Wake word & voice activation</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            On-device detection — audio never leaves this machine while standing by.
          </p>
        </div>

        {wake.status === "disabled" ? (
          <Button size="sm" onClick={() => void wake.enable()} className="gap-1.5 bg-orion-cyan text-orion-cyan-foreground hover:bg-orion-cyan/90">
            <Power className="h-3.5 w-3.5" />
            Enable
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={() => void wake.disable()} className="gap-1.5">
            <MicOff className="h-3.5 w-3.5" />
            Disable mic
          </Button>
        )}
      </div>

      {/* Clear, always-visible microphone + listening status */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={cn("gap-1.5 text-[11px]", STATUS_BADGE_CLASS[wake.status])}>
          {wake.status === "starting" || wake.status === "greeting" || wake.status === "processing" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : wake.status === "error" ? (
            <AlertCircle className="h-3 w-3" />
          ) : wake.status === "listening" ? (
            <Ear className="h-3 w-3" />
          ) : micOpen ? (
            <Mic className="h-3 w-3" />
          ) : (
            <MicOff className="h-3 w-3" />
          )}
          {wake.status === "listening" ? "ORION listening" : wake.status}
        </Badge>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
            micOpen ? "border-orion-success/40 text-orion-success" : "border-white/10 text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              micOpen ? "animate-pulse bg-orion-success" : "bg-muted-foreground"
            )}
          />
          Microphone {micOpen ? "open" : "closed"}
        </span>

        {wake.activeKeyword && wake.status !== "disabled" && (
          <span className="text-[11px] text-muted-foreground">
            Trigger: <span className="font-mono">{wake.activeKeyword}</span>
          </span>
        )}

        {isListeningTurn && (
          <Button size="sm" variant="ghost" onClick={wake.cancel} className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground">
            <XCircle className="h-3 w-3" />
            Not now
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{wake.errorMessage ?? STATUS_COPY[wake.status]}</p>

      {wake.status === "error" && wake.errorMessage && (
        <Button size="sm" variant="outline" onClick={() => void wake.enable()}>
          Retry
        </Button>
      )}

      {/* Standalone test harness — verifies wake -> greet -> listen -> transcribe
          end to end without the AI brain connected yet. */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5" />
            Test log
          </span>
          <span>
            Wake events: <span className="font-mono text-foreground">{wake.wakeCount}</span>
          </span>
        </div>

        {wake.lastUtterance ? (
          <div className="space-y-1">
            <p className="text-sm">{wake.lastUtterance.text}</p>
            <Badge variant="secondary" className="text-[10px]">
              Detected language: {wake.lastUtterance.language}
            </Badge>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No utterance captured yet — trigger the wake phrase, then speak. Not yet connected to the Claude AI brain;
            this only proves wake detection, TTS, and multilingual transcription work end to end.
          </p>
        )}
      </div>
    </div>
  );
}
