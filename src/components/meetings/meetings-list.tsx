"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Video, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/dashboard/empty-state";

interface MeetingListItem {
  id: string;
  title: string;
  dateString: string | null;
  duration: number | null;
  participants: string[];
  summary: { short_summary: string | null; overview: string | null } | null;
}

export function MeetingsList() {
  const [meetings, setMeetings] = useState<MeetingListItem[] | null>(null);
  const [query, setQuery] = useState("");

  function load(search?: string) {
    const url = search ? `/api/fireflies/meetings?q=${encodeURIComponent(search)}` : "/api/fireflies/meetings";
    fetch(url)
      .then((res) => res.json())
      .then((data) => setMeetings(data.meetings ?? []))
      .catch(() => toast.error("Failed to load meetings."));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search meetings by title…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") load(query);
        }}
        className="border-white/10 bg-white/5 focus-visible:ring-orion-cyan/40"
      />

      {meetings === null ? (
        <div className="glass-panel flex items-center justify-center gap-2 rounded-xl py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading meetings…
        </div>
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No meetings found"
          description="Once Fireflies records a meeting, it'll show up here automatically."
          phase="Fireflies"
        />
      ) : (
        <ul className="glass-panel divide-y divide-glass-border rounded-xl">
          {meetings.map((m) => (
            <li key={m.id}>
              <Link href={`/meetings/${m.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-white/5">
                <Video className="mt-0.5 h-4 w-4 shrink-0 text-orion-cyan" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.title || "(untitled meeting)"}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {m.summary?.short_summary ?? m.summary?.overview ?? "No summary yet."}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{m.dateString ?? ""}</span>
                    {m.participants.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {m.participants.length}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
