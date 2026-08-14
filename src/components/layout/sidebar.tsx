"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems, siteConfig } from "@/config/site";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-glass-border shrink-0">
      <div className="glass-panel flex h-full flex-col">
        <div className="flex items-center gap-2 px-5 py-6">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-orion-cyan/10">
            <span className="signal-dot h-2 w-2 rounded-full bg-orion-cyan text-orion-cyan" />
          </div>
          <div className="leading-tight">
            <p className="font-semibold tracking-wide glow-text">{siteConfig.name}</p>
            <p className="text-[11px] text-muted-foreground">{siteConfig.tagline}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-orion-cyan/10 text-foreground glow-border"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-orion-cyan" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 text-[11px] text-muted-foreground">
          <p>ORION AI OS · v0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
