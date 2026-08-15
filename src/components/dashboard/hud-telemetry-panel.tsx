"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Cpu, MemoryStick, Clock } from "lucide-react";
import { useSystemStats } from "@/hooks/use-system-stats";

function MiniGauge({ label, value, icon: Icon }: { label: string; value: number | null; icon: typeof Cpu }) {
  return (
    <div className="glass-panel flex items-center gap-2 rounded-lg px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-orion-cyan" />
      <div>
        <div className="font-mono text-sm font-semibold">{value === null ? "—" : `${value}%`}</div>
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function LiveClock() {
  // Starts null (not `new Date()`) so server-rendered HTML and the first
  // client render match — a live clock can't render a real value from the
  // server anyway. The interval's first tick fills it in a moment later.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass-panel flex items-center gap-2 rounded-lg px-3 py-2">
      <Clock className="h-3.5 w-3.5 text-orion-violet" />
      <div>
        <div className="font-mono text-sm font-semibold tabular-nums">
          {now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
        </div>
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Local time</div>
      </div>
    </div>
  );
}

// Only ever mounted when authEnabled is true (see HudTelemetryPanel below) —
// useUser() throws outside a <ClerkProvider>, which only wraps the tree
// when Clerk is actually configured, so this can't be an unconditional hook.
function UserIdentityBadge() {
  const { user } = useUser();
  if (!user) return null;

  return (
    <div className="glass-panel flex items-center gap-2 rounded-lg px-3 py-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orion-cyan/15 text-[10px] font-semibold text-orion-cyan">
        {(user.firstName?.[0] ?? user.username?.[0] ?? "U").toUpperCase()}
      </div>
      <div>
        <div className="text-xs font-medium leading-none">{user.firstName ?? user.username ?? "Operator"}</div>
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">ORION user</div>
      </div>
    </div>
  );
}

/** Corner HUD readouts — real Electron system telemetry where available, honest dashes on web. */
export function HudTelemetryPanel({ authEnabled }: { authEnabled: boolean }) {
  const stats = useSystemStats();

  return (
    <>
      <div className="absolute left-4 top-4 flex flex-col gap-2">
        <MiniGauge label="CPU" value={stats?.cpuPercent ?? null} icon={Cpu} />
        <MiniGauge label="Memory" value={stats?.memPercent ?? null} icon={MemoryStick} />
      </div>

      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <LiveClock />
        {authEnabled && <UserIdentityBadge />}
      </div>
    </>
  );
}
