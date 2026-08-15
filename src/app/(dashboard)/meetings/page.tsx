import { Video } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MeetingsList } from "@/components/meetings/meetings-list";
import { features } from "@/lib/env";

export default function MeetingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold glow-text">Meetings</h1>
        <p className="text-sm text-muted-foreground">
          Recent meetings, transcripts, summaries, and action items via Fireflies.
        </p>
      </div>

      {features.meetings ? (
        <MeetingsList />
      ) : (
        <EmptyState
          icon={Video}
          title="Fireflies isn't connected"
          description="Set FIREFLIES_API_KEY (see /system) to pull meeting transcripts, summaries, and action items."
          phase="Fireflies"
        />
      )}
    </div>
  );
}
