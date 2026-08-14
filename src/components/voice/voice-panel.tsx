"use client";

import { useEffect, useState } from "react";
import { Mic, Square, Loader2, Volume2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useVoiceAssistant } from "@/hooks/use-voice-assistant";

const stateCopy: Record<string, string> = {
  idle: "Tap to talk to ORION",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Something went wrong",
};

export function VoicePanel({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const voice = useVoiceAssistant();

  useEffect(() => {
    if (!open) voice.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleTriggerClick() {
    if (!enabled) {
      toast.error("Voice needs OPENAI_API_KEY and ELEVENLABS_API_KEY configured (see /system).");
      return;
    }
    setOpen(true);
  }

  function handleMicClick() {
    if (voice.state === "listening") voice.stopListening();
    else if (voice.state === "idle" || voice.state === "error") void voice.startListening();
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          aria-label="Activate voice mode"
          onClick={handleTriggerClick}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "text-muted-foreground hover:text-orion-cyan"
          )}
        >
          <Mic className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>Say &quot;Hey Orion&quot; or click to talk</TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="glass-panel mx-auto max-w-lg rounded-t-2xl border-t">
          <SheetHeader>
            <SheetTitle className="glow-text">Voice mode</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col items-center gap-6 px-4 pb-8 pt-2">
            <button
              type="button"
              onClick={handleMicClick}
              disabled={voice.state === "thinking" || voice.state === "speaking"}
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-full border transition-all",
                voice.state === "listening" &&
                  "border-orion-cyan bg-orion-cyan/15 glow-border animate-pulse",
                voice.state === "idle" && "border-white/15 hover:border-orion-cyan/60",
                (voice.state === "thinking" || voice.state === "speaking") &&
                  "border-orion-violet/50 bg-orion-violet/10",
                voice.state === "error" && "border-orion-danger/50"
              )}
            >
              {voice.state === "listening" && <Square className="h-6 w-6 text-orion-cyan" />}
              {voice.state === "thinking" && (
                <Loader2 className="h-6 w-6 animate-spin text-orion-violet" />
              )}
              {voice.state === "speaking" && <Volume2 className="h-6 w-6 text-orion-violet" />}
              {voice.state === "idle" && <Mic className="h-6 w-6 text-muted-foreground" />}
              {voice.state === "error" && <AlertCircle className="h-6 w-6 text-orion-danger" />}
            </button>

            <p className="text-sm text-muted-foreground">
              {voice.errorMessage ?? stateCopy[voice.state]}
            </p>

            {(voice.transcript || voice.replyText) && (
              <div className="w-full space-y-3">
                {voice.transcript && (
                  <p className="glass-panel rounded-xl px-4 py-2.5 text-sm">{voice.transcript}</p>
                )}
                {voice.replyText && (
                  <p className="rounded-xl bg-orion-cyan/10 px-4 py-2.5 text-sm">{voice.replyText}</p>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
