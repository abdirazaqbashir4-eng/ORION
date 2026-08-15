import "server-only";
import { features } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function logAuditEvent(
  userId: string | null,
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  if (!features.database) return;
  try {
    const supabase = createServiceSupabaseClient();
    await supabase.from("audit_log").insert({ user_id: userId, event_type: eventType, metadata });
  } catch (err) {
    console.error("Failed to write audit log entry:", err);
  }
}
