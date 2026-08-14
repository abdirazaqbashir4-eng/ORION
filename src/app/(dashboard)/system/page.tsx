import { CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { env, features } from "@/lib/env";

const integrations: { key: keyof typeof features; label: string; envVars: string[] }[] = [
  { key: "auth", label: "Authentication — Clerk", envVars: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"] },
  { key: "database", label: "Database — Supabase", envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] },
  { key: "ai", label: "AI — Claude API", envVars: ["ANTHROPIC_API_KEY"] },
  { key: "voiceStt", label: "Voice — Whisper (STT)", envVars: ["OPENAI_API_KEY"] },
  { key: "voiceTts", label: "Voice — ElevenLabs (TTS)", envVars: ["ELEVENLABS_API_KEY"] },
  { key: "email", label: "Email — Gmail", envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { key: "browserAutomation", label: "Browser automation — Playwright", envVars: ["auto-detected (disabled on Vercel)"] },
  { key: "monitoring", label: "Monitoring — Sentry", envVars: ["NEXT_PUBLIC_SENTRY_DSN"] },
  { key: "analytics", label: "Analytics — PostHog", envVars: ["NEXT_PUBLIC_POSTHOG_KEY"] },
];

export default function SystemPage() {
  const connectedCount = integrations.filter((i) => features[i.key]).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold glow-text">System Monitor</h1>
        <p className="text-sm text-muted-foreground">
          Live integration status, derived from environment configuration.
        </p>
      </div>

      <div className="glass-panel rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium">Integrations</span>
          <span className="font-mono text-xs text-muted-foreground">
            {connectedCount} / {integrations.length} connected
          </span>
        </div>
        <ul className="divide-y divide-glass-border">
          {integrations.map((integration) => {
            const connected = features[integration.key];
            return (
              <li key={integration.key} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {connected ? (
                    <CheckCircle2 className="h-4 w-4 text-orion-success" />
                  ) : (
                    <CircleAlert className="h-4 w-4 text-orion-warning" />
                  )}
                  <div>
                    <p className="text-sm">{integration.label}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {integration.envVars.join(", ")}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                    connected
                      ? "bg-orion-success/15 text-orion-success"
                      : "bg-orion-warning/15 text-orion-warning"
                  )}
                >
                  {connected ? "Connected" : "Not configured"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="glass-panel rounded-xl p-5">
        <span className="text-sm font-medium">Runtime</span>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Environment</dt>
            <dd className="font-mono">{env.NODE_ENV}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">App URL</dt>
            <dd className="font-mono">{env.NEXT_PUBLIC_APP_URL}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
