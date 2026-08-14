import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEmailDetail } from "@/lib/google/gmail";

export const runtime = "nodejs";

const requestSchema = z.object({
  emailId: z.string().min(1),
  note: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  if (!features.email || !features.database) {
    return NextResponse.json({ error: "Gmail and the database must both be configured." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = await getEmailDetail(user.id, parsed.data.emailId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: `Follow up: ${email.subject || "(no subject)"}`,
      description: parsed.data.note ?? `From: ${email.from}`,
      priority: "medium",
      due_date: dueDate.toISOString(),
      metadata: { source: "email", emailId: email.id, threadId: email.threadId, from: email.from },
    })
    .select("*")
    .single();
  if (error) throw error;

  return NextResponse.json({ task: data });
}
