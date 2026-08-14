import { Sunrise } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { GenerateBriefingButton } from "@/components/dashboard/generate-briefing-button";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Briefing } from "@/lib/supabase/types";

function BriefingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold glow-text">Daily Briefing</h1>
        <p className="text-sm text-muted-foreground">
          Emails, revenue, calendar, news, and AI recommendations in one view.
        </p>
      </div>
      {children}
    </div>
  );
}

export default async function BriefingPage() {
  if (!features.database) {
    return (
      <BriefingShell>
        <EmptyState
          icon={Sunrise}
          title="No briefing generated yet"
          description="Connect Supabase and set up the Morning Briefing automation (Task Center) to generate this daily."
          phase="Phase 10"
        />
      </BriefingShell>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return (
      <BriefingShell>
        <EmptyState
          icon={Sunrise}
          title="Sign in to see your briefing"
          description="Briefings are scoped per account — sign in first."
          phase="Phase 2"
        />
      </BriefingShell>
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: briefing } = await supabase
    .from("briefings")
    .select("*")
    .eq("user_id", user.id)
    .order("briefing_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!briefing) {
    return (
      <BriefingShell>
        <EmptyState
          icon={Sunrise}
          title="No briefing yet"
          description="Set up the Morning Briefing automation in the Task Center, or generate one now."
          phase="Phase 10"
        />
        <GenerateBriefingButton />
      </BriefingShell>
    );
  }

  const b = briefing as Briefing;
  const emails = b.emails_summary as { unreadCount?: number; items?: { subject: string; from: string; urgency?: string }[] };
  const revenue = b.revenue_summary as { revenue?: number; expenses?: number; profit?: number };
  const tasks = b.tasks_summary as { openCount?: number; items?: { title: string; priority: string }[] };

  return (
    <BriefingShell>
      <div className="glass-panel rounded-xl p-5">
        <p className="text-xs text-muted-foreground">{b.briefing_date}</p>
        <p className="mt-1 text-sm">{b.summary || "No summary generated."}</p>
      </div>

      {Array.isArray(b.recommendations) && b.recommendations.length > 0 && (
        <div className="glass-panel rounded-xl p-5">
          <p className="mb-2 text-sm font-medium">Recommendations</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {(b.recommendations as string[]).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Unread email</p>
          <p className="mt-1 font-mono text-xl">{emails.unreadCount ?? "—"}</p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Revenue (7d)</p>
          <p className="mt-1 font-mono text-xl">
            {revenue.revenue !== undefined ? `$${revenue.revenue.toFixed(0)}` : "—"}
          </p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Open tasks</p>
          <p className="mt-1 font-mono text-xl">{tasks.openCount ?? "—"}</p>
        </div>
      </div>

      <GenerateBriefingButton />
    </BriefingShell>
  );
}
