"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Meeting {
  id: string;
  title: string;
  dateString: string | null;
  duration: number | null;
  participants: string[];
  transcript_url: string | null;
  summary: {
    overview: string | null;
    short_summary: string | null;
    keywords: string[];
    action_items: string | null;
  } | null;
  sentences: { speaker_name: string | null; text: string; index: number }[];
}

function parseActionItems(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.replace(/^[\s*•\-]+/, "").trim())
    .filter(Boolean);
}

export function MeetingDetail({ id }: { id: string }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/fireflies/meetings/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setMeeting(data.meeting);
      })
      .catch(() => setError("Failed to load meeting."));
  }, [id]);

  async function handleSaveToMemory() {
    setSaving(true);
    try {
      const res = await fetch(`/api/fireflies/meetings/${id}/save-to-memory`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Saved to ORION's memory.");
    } catch {
      toast.error("Couldn't save to memory.");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return <p className="glass-panel rounded-xl px-4 py-6 text-sm text-orion-danger">{error}</p>;
  }

  if (!meeting) {
    return (
      <div className="glass-panel flex items-center justify-center gap-2 rounded-xl py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading meeting…
      </div>
    );
  }

  const actionItems = parseActionItems(meeting.summary?.action_items);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold glow-text">{meeting.title || "(untitled meeting)"}</h1>
          <p className="text-sm text-muted-foreground">
            {meeting.dateString} · {meeting.participants.join(", ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="secondary" disabled={saving} onClick={() => void handleSaveToMemory()} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Save to memory
          </Button>
          {meeting.transcript_url && (
            <a
              href={meeting.transcript_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Fireflies
            </a>
          )}
        </div>
      </div>

      {meeting.summary?.overview && (
        <div className="glass-panel rounded-xl p-5">
          <p className="mb-2 text-sm font-medium">Summary</p>
          <p className="text-sm text-muted-foreground">{meeting.summary.overview}</p>
        </div>
      )}

      {actionItems.length > 0 && (
        <div className="glass-panel rounded-xl p-5">
          <p className="mb-2 text-sm font-medium">Action items</p>
          <ul className="space-y-1.5">
            {actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orion-success" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {meeting.summary?.keywords && meeting.summary.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {meeting.summary.keywords.map((k) => (
            <Badge key={k} variant="secondary" className="text-[10px]">
              {k}
            </Badge>
          ))}
        </div>
      )}

      {meeting.sentences.length > 0 && (
        <div className="glass-panel rounded-xl p-5">
          <p className="mb-3 text-sm font-medium">Transcript</p>
          <div className="max-h-96 space-y-2 overflow-y-auto text-sm">
            {meeting.sentences.map((s) => (
              <p key={s.index}>
                <span className="font-medium text-orion-cyan">{s.speaker_name ?? "Unknown"}: </span>
                <span className="text-muted-foreground">{s.text}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
