"use client";

import { Search, Bell } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VoicePanel } from "@/components/voice/voice-panel";
import { cn } from "@/lib/utils";

export function Topbar({
  authEnabled,
  voiceEnabled,
}: {
  authEnabled: boolean;
  voiceEnabled: boolean;
}) {
  return (
    <header className="glass-panel sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-glass-border px-4 md:px-6">
      <div className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Ask ORION anything…"
          className="border-white/10 bg-white/5 pl-9 focus-visible:ring-orion-cyan/40"
        />
      </div>

      <div className="flex items-center gap-2">
        <VoicePanel enabled={voiceEnabled} />

        <Tooltip>
          <TooltipTrigger
            aria-label="Notifications"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bell className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        {authEnabled ? (
          <UserButton
            appearance={{
              elements: { avatarBox: "h-8 w-8 border border-glass-border rounded-full" },
            }}
          />
        ) : (
          <Tooltip>
            <TooltipTrigger className="cursor-default">
              <Avatar className="h-8 w-8 border border-glass-border">
                <AvatarFallback className="bg-orion-violet/20 text-xs">OP</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>Sign-in not configured yet (Phase 2)</TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
}
