interface OrionCoreProps {
  /** 0-100 — how many integrations are actually connected, driving the core's brightness/fill. */
  powerLevel: number;
  size?: number;
}

/**
 * The Command Center's central HUD element — a real gauge of ORION's own
 * connected-integration count, not decoration. Concentric rings rotate at
 * different speeds (pure CSS, see .orion-core-ring-* in globals.css);
 * the inner core's opacity and glow scale with `powerLevel`.
 */
export function OrionCore({ powerLevel, size = 280 }: OrionCoreProps) {
  const clamped = Math.max(0, Math.min(100, powerLevel));
  const center = size / 2;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle
          cx={center}
          cy={center}
          r={center - 6}
          fill="none"
          stroke="var(--orion-cyan)"
          strokeOpacity={0.25}
          strokeWidth={1}
          strokeDasharray="2 6"
        />
      </svg>

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="orion-core-ring-slow absolute inset-0"
      >
        <circle
          cx={center}
          cy={center}
          r={center * 0.78}
          fill="none"
          stroke="var(--orion-cyan)"
          strokeOpacity={0.4}
          strokeWidth={2}
          strokeDasharray={`${center * 1.4} ${center * 3.5}`}
        />
      </svg>

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="orion-core-ring-fast absolute inset-0"
      >
        <circle
          cx={center}
          cy={center}
          r={center * 0.64}
          fill="none"
          stroke="var(--orion-violet)"
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeDasharray={`${center * 0.6} ${center * 3.2}`}
        />
      </svg>

      <div
        className="orion-core-pulse flex items-center justify-center rounded-full"
        style={{
          width: size * 0.42,
          height: size * 0.42,
          background: `radial-gradient(circle, oklch(0.75 0.15 210 / ${0.15 + clamped / 250}) 0%, transparent 70%)`,
        }}
      >
        <div
          className="flex flex-col items-center justify-center rounded-full border"
          style={{
            width: size * 0.34,
            height: size * 0.34,
            borderColor: `oklch(0.75 0.15 210 / ${0.3 + clamped / 200})`,
            boxShadow: `0 0 ${12 + clamped / 3}px oklch(0.75 0.15 210 / ${0.3 + clamped / 250})`,
            background: "oklch(0.17 0.025 255 / 80%)",
          }}
        >
          <span className="glow-text font-mono text-2xl font-bold">{Math.round(clamped)}%</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Online</span>
        </div>
      </div>
    </div>
  );
}
