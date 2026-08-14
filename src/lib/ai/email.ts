import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, CHAT_MODEL } from "./anthropic";

export interface EmailClassification {
  category: "work" | "personal" | "finance" | "newsletter" | "spam" | "other";
  urgency: "low" | "medium" | "high";
}

function firstTextBlock(res: Anthropic.Messages.Message): string {
  return res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")?.text ?? "";
}

export async function classifyEmails(
  emails: { id: string; from: string; subject: string; snippet: string }[]
): Promise<Record<string, EmailClassification>> {
  if (emails.length === 0) return {};
  const anthropic = getAnthropicClient();

  const res = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 2048,
    system:
      'Classify each email by category ("work" | "personal" | "finance" | "newsletter" | "spam" | "other") and urgency ("low" | "medium" | "high"). Respond with ONLY a JSON object mapping email id to {"category": ..., "urgency": ...}. No prose, no markdown fences.',
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          emails.map((e) => ({ id: e.id, from: e.from, subject: e.subject, snippet: e.snippet.slice(0, 200) }))
        ),
      },
    ],
  });

  const match = firstTextBlock(res).match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match?.[0] ?? "{}") as Record<string, EmailClassification>;
  } catch {
    return {};
  }
}

export async function draftEmailReply(
  email: { from: string; subject: string; body: string },
  instructions?: string
): Promise<string> {
  const anthropic = getAnthropicClient();
  const res = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 1024,
    system:
      "You draft concise, professional email replies for the user to review before sending. Write only the reply body — no subject line, no commentary, no placeholders like [Your Name] unless truly necessary.",
    messages: [
      {
        role: "user",
        content: `Draft a reply to this email:\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.body.slice(0, 3000)}\n\n${instructions ? `Instructions: ${instructions}` : "Keep it brief and helpful."}`,
      },
    ],
  });
  return firstTextBlock(res);
}
