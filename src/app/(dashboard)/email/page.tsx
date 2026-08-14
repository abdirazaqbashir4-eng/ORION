import { Mail } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { EmailInbox } from "@/components/email/email-inbox";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { isGmailConnected } from "@/lib/google/oauth";

function EmailShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold glow-text">Email Center</h1>
        <p className="text-sm text-muted-foreground">
          Inbox summary, priority emails, and suggested replies.
        </p>
      </div>
      {children}
    </div>
  );
}

export default async function EmailPage() {
  if (!features.email) {
    return (
      <EmailShell>
        <EmptyState
          icon={Mail}
          title="Gmail isn't connected"
          description="Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see /system) to enable email integration."
          phase="Phase 9"
        />
      </EmailShell>
    );
  }

  const user = features.database ? await getCurrentUser() : null;
  if (!user) {
    return (
      <EmailShell>
        <EmptyState
          icon={Mail}
          title="Sign in to connect Gmail"
          description="Email access is scoped per account — sign in first, then connect Gmail."
          phase="Phase 2"
        />
      </EmailShell>
    );
  }

  const connected = await isGmailConnected(user.id);
  if (!connected) {
    return (
      <EmailShell>
        <div className="glass-panel flex flex-col items-center gap-4 rounded-xl py-16 text-center">
          <Mail className="h-6 w-6 text-orion-cyan" />
          <div>
            <p className="font-medium">Connect your Gmail account</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              ORION will read your inbox, categorize messages by urgency, and draft replies for
              your review — it never sends anything without you.
            </p>
          </div>
          <a
            href="/api/auth/google"
            className="rounded-lg bg-orion-cyan px-4 py-2 text-sm font-medium text-orion-cyan-foreground hover:bg-orion-cyan/90"
          >
            Connect Gmail
          </a>
        </div>
      </EmailShell>
    );
  }

  return (
    <EmailShell>
      <EmailInbox />
    </EmailShell>
  );
}
