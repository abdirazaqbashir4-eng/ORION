import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { features } from "@/lib/env";
import { getAnthropicClient, CHAT_MODEL } from "@/lib/ai/anthropic";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveMemory, searchMemories } from "@/lib/memory/store";
import { AGENTS } from "@/lib/agents/registry";
import { getToolsForAgent, executeTool } from "@/lib/agents/tools";
import type { AgentType } from "@/lib/agents/types";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TOOL_ROUNDS = 4;

const attachmentSchema = z.object({
  mediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
  data: z.string(),
});

const requestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(16000),
  attachments: z.array(attachmentSchema).max(5).optional(),
  agentType: z.enum(["general", "developer", "business", "marketing", "research", "executive"]).default("general"),
});

export async function POST(req: Request) {
  if (!features.ai) {
    return NextResponse.json(
      { error: "AI chat is not configured. Set ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { message, attachments, agentType } = parsed.data;
  let conversationId = parsed.data.conversationId ?? null;

  const preAuthUser = features.database ? await getCurrentUser() : null;
  const { allowed } = rateLimit(rateLimitKeyFor(req, preAuthUser?.id ?? null, "chat"), {
    limit: 20,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  let userId: string | null = null;
  let priorMessages: { role: "user" | "assistant"; content: string }[] = [];
  let memoryContext: string | undefined;

  if (features.database) {
    const user = preAuthUser;
    if (user) {
      userId = user.id;
      const supabase = createServerSupabaseClient();

      if (!conversationId) {
        const { data, error } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, title: message.slice(0, 60), agent_type: agentType })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = data.id;
      }

      const { data: history, error: historyError } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (historyError) throw historyError;

      priorMessages = (history ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const { error: insertError } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, role: "user", content: message });
      if (insertError) throw insertError;

      if (features.embeddings) {
        try {
          const related = await searchMemories(user.id, message, { limit: 5 });
          if (related.length > 0) {
            memoryContext = related.map((m) => `- ${m.summary ?? m.content}`).join("\n");
          }
          await saveMemory(user.id, { type: "conversation", content: message, source: "chat" });
        } catch (err) {
          console.error("Memory pipeline failed:", err);
        }
      }
    }
  }

  const anthropic = getAnthropicClient();

  const userContent: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: message }];
  for (const attachment of attachments ?? []) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: attachment.mediaType, data: attachment.data },
    });
  }

  const systemPrompt = buildSystemPrompt({
    agentPersona: agentType === "general" ? undefined : AGENTS[agentType as AgentType].systemPrompt,
    memoryContext,
  });
  const tools = getToolsForAgent(agentType);

  const messages: Anthropic.MessageParam[] = [
    ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userContent },
  ];

  const encoder = new TextEncoder();
  let assistantText = "";
  const finalConversationId = conversationId;
  const finalUserId = userId;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const stream = anthropic.messages.stream({
            model: CHAT_MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            tools: tools.length > 0 ? tools : undefined,
            messages,
          });

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              assistantText += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }

          const finalMessage = await stream.finalMessage();

          if (finalMessage.stop_reason !== "tool_use") break;

          const toolUseBlocks = finalMessage.content.filter(
            (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
          );

          messages.push({ role: "assistant", content: finalMessage.content });

          const toolResults = await Promise.all(
            toolUseBlocks.map(async (block) => ({
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: await executeTool(block.name, block.input, finalUserId),
            }))
          );

          messages.push({ role: "user", content: toolResults });
        }

        if (features.database && finalUserId && finalConversationId) {
          const supabase = createServerSupabaseClient();
          await supabase
            .from("messages")
            .insert({ conversation_id: finalConversationId, role: "assistant", content: assistantText });
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": conversationId ?? "",
    },
  });
}
