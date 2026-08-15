import "server-only";
import { saveMemory } from "@/lib/memory/store";
import { parseActionItems } from "./types";
import type { FirefliesMeetingSummary } from "./types";

/** Saves a meeting's summary and action items into ORION's long-term memory (Phase 6). */
export async function syncMeetingToMemory(userId: string, meeting: FirefliesMeetingSummary) {
  const actionItems = parseActionItems(meeting.summary?.action_items);
  const overview = meeting.summary?.overview ?? meeting.summary?.short_summary ?? "No summary available.";

  const content = [
    `Meeting: ${meeting.title} (${meeting.dateString ?? new Date(meeting.date).toLocaleDateString()})`,
    `Participants: ${meeting.participants.join(", ") || "unknown"}`,
    `Summary: ${overview}`,
    actionItems.length > 0 ? `Action items: ${actionItems.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return saveMemory(userId, {
    type: "note",
    content,
    summary: overview,
    source: "fireflies",
    metadata: { meetingId: meeting.id, actionItems, transcriptUrl: meeting.transcript_url },
  });
}
