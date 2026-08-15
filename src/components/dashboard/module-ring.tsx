"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ModuleRingItem {
  title: string;
  href: string;
  /**
   * A pre-rendered icon element (e.g. `<Icon className="h-4 w-4" />`),
   * not a bare component reference — this is a Client Component receiving
   * props from a Server Component parent, and React can only serialize
   * elements across that boundary, not function/component values.
   */
  icon: React.ReactNode;
}

interface ModuleRingProps {
  items: ModuleRingItem[];
  radius: number;
  containerSize: number;
}

/** Positions nav items evenly around a circle, starting at 12 o'clock. */
export function ModuleRing({ items, radius, containerSize }: ModuleRingProps) {
  const pathname = usePathname();
  const center = containerSize / 2;

  return (
    <div className="relative" style={{ width: containerSize, height: containerSize }}>
      {items.map((item, i) => {
        const angle = (i / items.length) * 2 * Math.PI - Math.PI / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.title}
            className={cn(
              "glass-panel hud-corner absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full transition-all hover:scale-110 hover:glow-border",
              active && "glow-border border-orion-cyan/60"
            )}
            style={{ left: x, top: y }}
          >
            <span className={active ? "text-orion-cyan" : "text-muted-foreground"}>{item.icon}</span>
            <span className="text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.title.split(" ")[0]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
