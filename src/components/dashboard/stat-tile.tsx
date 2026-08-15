import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon: LucideIcon;
}

export function StatTile({ label, value, delta, trend = "flat", icon: Icon }: StatTileProps) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-orion-cyan" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold">{value}</span>
        {delta && (
          <span
            className={cn(
              "text-xs font-medium",
              trend === "up" && "text-orion-success",
              trend === "down" && "text-orion-danger",
              trend === "flat" && "text-muted-foreground"
            )}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
