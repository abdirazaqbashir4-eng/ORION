import { DollarSign, TrendingUp, Mail, ListChecks } from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ModuleCard } from "@/components/dashboard/module-card";
import { OrionCore } from "@/components/dashboard/orion-core";
import { ModuleRing } from "@/components/dashboard/module-ring";
import { CircularGauge } from "@/components/dashboard/circular-gauge";
import { HudTelemetryPanel } from "@/components/dashboard/hud-telemetry-panel";
import { navItems } from "@/config/site";
import { features } from "@/lib/env";

export default function CommandCenterPage() {
  const modules = navItems.filter((item) => item.href !== "/" && item.href !== "/settings");

  const moduleStatus: Record<string, "online" | "pending"> = {
    "/chat": features.ai ? "online" : "pending",
    "/briefing": features.ai && features.database ? "online" : "pending",
    "/meetings": features.meetings ? "online" : "pending",
    "/business": features.database ? "online" : "pending",
    "/email": features.email ? "online" : "pending",
    "/tasks": features.database ? "online" : "pending",
    "/system": "online",
  };

  const coreFlags = [features.auth, features.database, features.ai];
  const voiceFlags = [features.voiceStt, features.voiceTts];
  const extendedFlags = [
    features.email,
    features.browserAutomation,
    features.monitoring,
    features.analytics,
    features.meetings,
  ];
  const allFlags = [...coreFlags, ...voiceFlags, ...extendedFlags];
  const pct = (flags: boolean[]) => Math.round((flags.filter(Boolean).length / flags.length) * 100);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold glow-text">Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Everything ORION is watching, running, and ready to help with.
        </p>
      </div>

      {/* HUD hero — desktop only; a circular radial layout doesn't hold up on narrow screens */}
      <div className="glass-panel hud-corner hud-grid-bg relative hidden overflow-hidden rounded-2xl px-4 py-8 lg:block">
        <HudTelemetryPanel authEnabled={features.auth} />

        <div className="mx-auto flex max-w-5xl items-center justify-between gap-8">
          <CircularGauge value={pct(coreFlags)} valueLabel={`${pct(coreFlags)}%`} label="Core Systems" />

          <div className="relative flex items-center justify-center">
            <ModuleRing
              items={modules.map((item) => ({
                title: item.title,
                href: item.href,
                icon: <item.icon className="h-4 w-4" />,
              }))}
              radius={160}
              containerSize={380}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <OrionCore powerLevel={pct(allFlags)} size={200} />
            </div>
          </div>

          <CircularGauge
            value={pct(voiceFlags)}
            valueLabel={`${pct(voiceFlags)}%`}
            label="Voice"
            colorVar="var(--orion-violet)"
          />
        </div>
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
