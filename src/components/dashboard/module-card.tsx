import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  status?: "online" | "pending" | "offline";
  children?: React.ReactNode;
}

const statusMap = {
  online: { label: "Online", className: "bg-orion-success/15 text-orion-success" },
  pending: { label: "Needs setup", className: "bg-orion-warning/15 text-orion-warning" },
  offline: { label: "Offline", className: "bg-muted text-muted-foreground" },
};

export function ModuleCard({
  title,
  description,
  href,
  icon: Icon,
  status = "pending",
  children,
}: ModuleCardProps) {
  const statusInfo = statusMap[status];

  return (
    <Link
      href={href}
      className="glass-panel group flex flex-col gap-3 rounded-xl p-5 transition-all hover:glow-border"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orion-cyan/10">
          <Icon className="h-4.5 w-4.5 text-orion-cyan" />
        </div>
        <Badge variant="secondary" className={cn("text-[10px]", statusInfo.className)}>
          {statusInfo.label}
        </Badge>
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <h3 className="font-medium">{title}</h3>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      {children}
    </Link>
  );
}
