"use client";

import { useEffect, useState } from "react";
import { Mail, Reply, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface EmailItem {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  category?: string;
  urgency?: "low" | "medium" | "high";
}

const urgencyStyles: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-orion-warning/15 text-orion-warning",
  high: "bg-orion-danger/15 text-orion-danger",
};

export function EmailInbox() {
  const [emails, setEmails] = useState<EmailItem[] | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email/messages")
      .then((res) => res.json())
      .then((data) => setEmails(data.emails ?? []))
      .catch(() => toast.error("Failed to load inbox."));
  }, []);

  async function handleDraft(email: EmailItem) {
    setBusyId(email.id);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id }),
      });
      if (!res.ok) throw new Error("Draft generation failed");
      const data = (await res.json()) as { replyText: string };
      setDraftText((prev) => ({ ...prev, [email.id]: data.replyText }));
      setDraftingId(email.id);
      toast.success("Draft saved to your Gmail drafts.");
    } catch {
      toast.error("Couldn't draft a reply.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleFollowUp(email: EmailItem) {
    setBusyId(email.id);
    try {
      const res = await fetch("/api/email/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Follow-up task created.");
    } catch {
      toast.error("Couldn't create a follow-up.");
    } finally {
      setBusyId(null);
    }
  }

  if (emails === null) {
    return (
      <div className="glass-panel flex items-center justify-center gap-2 rounded-xl py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading inbox…
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-2 rounded-xl py-16 text-center">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No messages found.</p>
      </div>
    );
  }

  return (
    <ul className="glass-panel divide-y divide-glass-border rounded-xl">
      {emails.map((email) => (
        <li key={email.id} className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={cn("truncate text-sm", email.unread && "font-semibold")}>
                  {email.subject || "(no subject)"}
                </p>
                {email.urgency && (
                  <Badge variant="secondary" className={cn("shrink-0 text-[10px]", urgencyStyles[email.urgency])}>
                    {email.urgency}
                  </Badge>
                )}
                {email.category && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {email.category}
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{email.from}</p>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">{email.snippet}</p>
            </div>

            <div className="flex shrink-0 gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Draft reply"
                disabled={busyId === email.id}
                onClick={() => void handleDraft(email)}
                className="text-muted-foreground hover:text-orion-cyan"
              >
                <Reply className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Create follow-up task"
                disabled={busyId === email.id}
                onClick={() => void handleFollowUp(email)}
                className="text-muted-foreground hover:text-orion-warning"
              >
                <Clock className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {draftingId === email.id && draftText[email.id] && (
            <Textarea
              value={draftText[email.id]}
              onChange={(e) => setDraftText((prev) => ({ ...prev, [email.id]: e.target.value }))}
              className="mt-2 border-white/10 bg-white/5 text-sm"
              rows={4}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
