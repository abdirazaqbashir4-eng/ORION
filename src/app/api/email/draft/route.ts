import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { getEmailDetail, createDraftReply } from "@/lib/google/gmail";
import { draftEmailReply } from "@/lib/ai/email";

export const runtime = "nodejs";

const requestSchema = z.object({
  emailId: z.string().min(1),
  instructions: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  if (!features.email || !features.ai) {
    return NextResponse.json({ error: "Gmail and Claude must both be configured." }, { status: 503 });
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
  const replyText = await draftEmailReply(email, parsed.data.instructions);

  const draft = await createDraftReply(user.id, {
    to: email.from,
    subject: email.subject,
    body: replyText,
    threadId: email.threadId,
  });

  return NextResponse.json({ draftId: draft.id, replyText });
}
