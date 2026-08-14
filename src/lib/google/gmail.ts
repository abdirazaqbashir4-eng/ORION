import "server-only";
import type { gmail_v1 } from "googleapis";
import { getGmailClientForUser } from "./oauth";

export interface EmailSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

function extractHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function listRecentEmails(
  userId: string,
  opts: { maxResults?: number; query?: string } = {}
): Promise<EmailSummary[]> {
  const gmail = await getGmailClientForUser(userId);
  if (!gmail) return [];

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: opts.maxResults ?? 20,
    q: opts.query,
  });

  const messages = list.data.messages ?? [];
  const details = await Promise.all(
    messages.map((m) =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      })
    )
  );

  return details.map((res) => ({
    id: res.data.id!,
    threadId: res.data.threadId!,
    from: extractHeader(res.data.payload?.headers, "From"),
    subject: extractHeader(res.data.payload?.headers, "Subject"),
    snippet: res.data.snippet ?? "",
    date: extractHeader(res.data.payload?.headers, "Date"),
    unread: res.data.labelIds?.includes("UNREAD") ?? false,
  }));
}

function findPlainTextBody(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  for (const child of part.parts ?? []) {
    const found = findPlainTextBody(child);
    if (found) return found;
  }
  return "";
}

export async function getEmailDetail(userId: string, messageId: string) {
  const gmail = await getGmailClientForUser(userId);
  if (!gmail) throw new Error("Gmail is not connected for this user.");

  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const body = findPlainTextBody(res.data.payload) || res.data.snippet || "";

  return {
    id: res.data.id!,
    threadId: res.data.threadId!,
    from: extractHeader(res.data.payload?.headers, "From"),
    subject: extractHeader(res.data.payload?.headers, "Subject"),
    body,
  };
}

export async function createDraftReply(
  userId: string,
  params: { to: string; subject: string; body: string; threadId?: string }
) {
  const gmail = await getGmailClientForUser(userId);
  if (!gmail) throw new Error("Gmail is not connected for this user.");

  const subject = params.subject.startsWith("Re:") ? params.subject : `Re: ${params.subject}`;
  const messageParts = [
    `To: ${params.to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    params.body,
  ];
  const raw = Buffer.from(messageParts.join("\n")).toString("base64url");

  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw, threadId: params.threadId } },
  });

  return draft.data;
}
