"use client";

import { useEffect, useState } from "react";
import { Zap, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AutomationRun {
  status: "running" | "success" | "failed";
  started_at: string;
  finished_at: string | null;
}

interface Automation {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  next_run_at: string | null;
  automation_runs: AutomationRun[];
}

const statusStyles: Record<string, string> = {
  success: "bg-orion-success/15 text-orion-success",
  failed: "bg-orion-danger/15 text-orion-danger",
  running: "bg-orion-warning/15 text-orion-warning",
};

export function AutomationsPanel() {
  const [automations, setAutomations] = useState<Automation[] | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  function load() {
    fetch("/api/automations")
      .then((res) => res.json())
      .then((data) => setAutomations(data.automations ?? []))
      .catch(() => toast.error("Failed to load automations."));
  }

  useEffect(load, []);

  async function handleSetup() {
    try {
      await fetch("/api/automations", { method: "POST" });
      load();
    } catch {
      toast.error("Couldn't set up automations.");
    }
  }

  async function handleRun(id: string) {
    setRunningId(id);
    try {
      const res = await fetch(`/api/automations/${id}/run`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Automation ran successfully.");
      load();
    } catch {
      toast.error("Automation run failed.");
    } finally {
      setRunningId(null);
    }
  }

  if (automations === null) {
    return (
      <div className="glass-panel flex items-center justify-center gap-2 rounded-xl py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading automations…
      </div>
    );
  }

  if (automations.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 rounded-xl py-8 text-center">
        <Zap className="h-5 w-5 text-orion-cyan" />
        <p className="text-sm text-muted-foreground">
          Set up the Morning Briefing and Evening Summary automations.
        </p>
        <Button size="sm" onClick={() => void handleSetup()} className="bg-orion-cyan text-orion-cyan-foreground hover:bg-orion-cyan/90">
          Set up automations
        </Button>
      </div>
    );
  }

  return (
    <ul className="glass-panel divide-y divide-glass-border rounded-xl">
      {automations.map((automation) => {
        const lastRun = automation.automation_runs?.at(-1);
        return (
          <li key={automation.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{automation.name}</p>
                {lastRun && (
                  <Badge variant="secondary" className={cn("text-[10px]", statusStyles[lastRun.status])}>
                    {lastRun.status}
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{automation.description}</p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Run ${automation.name} now`}
              disabled={runningId === automation.id}
              onClick={() => void handleRun(automation.id)}
              className="shrink-0 text-muted-foreground hover:text-orion-cyan"
            >
              {runningId === automation.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
