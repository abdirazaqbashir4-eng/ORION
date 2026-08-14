import { DollarSign, TrendingUp, Mail, ListChecks } from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ModuleCard } from "@/components/dashboard/module-card";
import { navItems } from "@/config/site";
import { features } from "@/lib/env";

export default function CommandCenterPage() {
  const modules = navItems.filter((item) => item.href !== "/" && item.href !== "/settings");

  const moduleStatus: Record<string, "online" | "pending"> = {
    "/chat": features.ai ? "online" : "pending",
    "/briefing": features.ai && features.database ? "online" : "pending",
    "/business": features.database ? "online" : "pending",
    "/email": features.email ? "online" : "pending",
    "/tasks": features.database ? "online" : "pending",
    "/system": "online",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold glow-text">Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Everything ORION is watching, running, and ready to help with.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Revenue (MTD)" value="—" icon={DollarSign} />
        <StatTile label="Growth" value="—" icon={TrendingUp} />
        <StatTile label="Unread email" value="—" icon={Mail} />
        <StatTile label="Open tasks" value="—" icon={ListChecks} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Modules</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((item) => (
            <ModuleCard
              key={item.href}
              title={item.title}
              description={item.description}
              href={item.href}
              icon={item.icon}
              status={moduleStatus[item.href] ?? "pending"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
