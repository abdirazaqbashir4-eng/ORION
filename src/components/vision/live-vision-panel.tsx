"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Camera, MonitorUp, EyeOff, Layers, Square, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buttonVariants, Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLiveVision } from "@/hooks/use-live-vision";
import type { VisionMode } from "@/lib/vision/types";

const modeOptions: { value: VisionMode; label: string; icon: typeof Eye }[] = [
  { value: "off", label: "Off", icon: EyeOff },
  { value: "camera", label: "Camera", icon: Camera },
  { value: "screen", label: "Screen", icon: MonitorUp },
  { value: "both", label: "Both", icon: Layers },
];

function VideoPreview({ stream, label }: { stream: MediaStream | null; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-glass-border">
      <video ref={ref} autoPlay muted playsInline className="aspect-video w-full bg-black object-cover" />
      <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
        {label}
      </span>
    </div>
  );
}

export function LiveVisionPanel({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const vision = useLiveVision();

  useEffect(() => {
    if (!open) void vision.setMode("off");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleTriggerClick() {
    if (!enabled) {
      toast.error("Live Vision needs ANTHROPIC_API_KEY, OPENAI_API_KEY, and ELEVENLABS_API_KEY configured.");
      return;
    }
    setOpen(true);
  }

  const isLive = vision.mode !== "off";

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          aria-label="Live Vision"
          onClick={handleTriggerClick}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "text-muted-foreground hover:text-orion-cyan"
          )}
        >
          <Eye className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>Live Vision — camera or screen, with voice</TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="glass-panel mx-auto max-w-2xl rounded-t-2xl border-t">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <SheetTitle className="glow-text">Live Vision</SheetTitle>
              {isLive && (
                <span className="flex items-center gap-1.5 rounded-full bg-orion-danger/15 px-2.5 py-0.5 text-[11px] font-semibold text-orion-danger">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orion-danger" />
                  LIVE
                </span>
              )}
            </div>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4 pb-8 pt-2">
            <div className="flex gap-2">
              {modeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = vision.mode === opt.value;
                return (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={active ? "default" : "secondary"}
                    size="sm"
                    onClick={() => void vision.setMode(opt.value)}
                    className={cn("gap-1.5", active && "bg-orion-cyan text-orion-cyan-foreground")}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </Button>
                );
              })}

              {isLive && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={vision.stopAll}
                  className="ml-auto gap-1.5"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
              )}
            </div>

            {isLive && (
              <div className="grid grid-cols-2 gap-3">
                <VideoPreview stream={vision.cameraStream} label="Camera" />
                <VideoPreview stream={vision.screenStream} label="Screen" />
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {vision.state === "listening" && <span>Listening — talk about what&apos;s on screen…</span>}
              {vision.state === "thinking" && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking…
                </>
              )}
              {vision.state === "speaking" && (
                <>
                  <Volume2 className="h-3.5 w-3.5" /> Speaking…
                </>
              )}
              {vision.state === "idle" && !isLive && <span>Choose Camera, Screen, or Both to start.</span>}
              {vision.errorMessage && <span className="text-orion-danger">{vision.errorMessage}</span>}
            </div>

            {(vision.transcript || vision.replyText) && (
              <div className="space-y-2">
                {vision.transcript && (
                  <p className="glass-panel rounded-xl px-4 py-2.5 text-sm">{vision.transcript}</p>
                )}
                {vision.replyText && (
                  <p className="rounded-xl bg-orion-cyan/10 px-4 py-2.5 text-sm">{vision.replyText}</p>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
