import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}

export function EmptyState({ icon: Icon, title, description, phase }: EmptyStateProps) {
  return (
    <div className="glass-panel flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orion-cyan/10">
        <Icon className="h-5 w-5 text-orion-cyan" />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <span className="rounded-full bg-orion-warning/15 px-3 py-1 text-xs font-medium text-orion-warning">
        Wired in {phase}
      </span>
    </div>
  );
}
