import { Settings, Brain } from "lucide-react";
import { UserProfile } from "@clerk/nextjs";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { listRecentMemories } from "@/lib/memory/store";
import { WakeWordPanel } from "@/components/voice/wake-word-panel";
import { UpdatePanel } from "@/components/settings/update-panel";

// Per-user data via the RLS-scoped Supabase client depends on Clerk's
// auth() (request headers) — never statically prerenderable. UserProfile
// also renders per-session Clerk UI, which needs the same treatment.
export const dynamic = "force-dynamic";

async function MemoryPanel() {
  if (!features.database) {
    return (
      <EmptyState
        icon={Brain}
        title="Memory needs a database"
        description="Long-term memory is stored in Supabase — connect it to start building ORION's memory of you."
        phase="Phase 3"
      />
    );
  }

  const user = await getCurrentUser();
  if (!user) return null;

  const memories = await listRecentMemories(user.id, 20);

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium">Recent memories</span>
        <span className="font-mono text-xs text-muted-foreground">{memories.length}</span>
      </div>
      {memories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing remembered yet — memories build up automatically as you chat with ORION.
        </p>
      ) : (
        <ul className="divide-y divide-glass-border">
          {memories.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-4 py-3">
              <p className="line-clamp-2 text-sm text-foreground/90">{m.summary ?? m.content}</p>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {m.type}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold glow-text">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Integrations, preferences, memory, and security controls.
        </p>
      </div>

      <UpdatePanel />

      <MemoryPanel />

      <WakeWordPanel />

      {features.auth ? (
        <div className="glass-panel rounded-xl p-1">
          <UserProfile
            routing="hash"
            appearance={{ elements: { rootBox: "w-full", cardBox: "shadow-none w-full" } }}
          />
        </div>
      ) : (
        <EmptyState
          icon={Settings}
          title="Account settings arrive with auth"
          description="Profile, security, and integration management live here once Clerk authentication is wired up."
          phase="Phase 2"
        />
      )}
    </div>
  );
}
