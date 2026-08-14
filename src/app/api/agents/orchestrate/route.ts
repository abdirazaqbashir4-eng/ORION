import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { features } from "@/lib/env";
import { getAnthropicClient, CHAT_MODEL } from "@/lib/ai/anthropic";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/agents/registry";
import { getToolsForAgent, executeTool } from "@/lib/agents/tools";
import type { AgentType } from "@/lib/agents/types";
import { rateLimit, rateLimitKeyFor } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({ goal: z.string().min(1).max(4000) });

const SPECIALISTS: AgentType[] = ["developer", "business", "marketing", "research"];

async function planSpecialists(anthropic: Anthropic, goal: string): Promise<AgentType[]> {
  const res = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 256,
    system: `You are ORION's Executive Agent, deciding which specialists to consult for a goal. Specialists: ${SPECIALISTS.join(", ")}. Respond with ONLY a JSON array of 1-3 relevant specialist names, e.g. ["business","marketing"]. No prose.`,
    messages: [{ role: "user", content: goal }],
  });

  const text = res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")?.text ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  try {
    const parsed = JSON.parse(match?.[0] ?? "[]") as string[];
    const valid = parsed.filter((t): t is AgentType => SPECIALISTS.includes(t as AgentType)).slice(0, 3);
    return valid.length > 0 ? valid : ["business"];
  } catch {
    return ["business"];
  }
}

async function consultSpecialist(anthropic: Anthropic, type: AgentType, goal: string, userId: string | null) {
  const agent = AGENTS[type];
  const tools = getToolsForAgent(type);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: goal }];
  let finalText = "";

  for (let round = 0; round < 3; round++) {
    const res = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 2048,
      system: agent.systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
      messages,
    });

    const text = res.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (text) finalText = text;

    if (res.stop_reason !== "tool_use") break;

    const toolUseBlocks = res.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );
    messages.push({ role: "assistant", content: res.content });
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: await executeTool(block.name, block.input, userId),
      }))
    );
    messages.push({ role: "user", content: toolResults });
  }

  return { type, name: agent.name, output: finalText };
}

export async function POST(req: Request) {
  if (!features.ai) {
    return NextResponse.json(
      { error: "AI agents are not configured. Set ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { goal } = parsed.data;

  const user = features.database ? await getCurrentUser() : null;
  const { allowed } = rateLimit(rateLimitKeyFor(req, user?.id ?? null, "orchestrate"), {
    limit: 5,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  const anthropic = getAnthropicClient();

  const specialistTypes = await planSpecialists(anthropic, goal);
  const specialistResults = await Promise.all(
    specialistTypes.map((type) => consultSpecialist(anthropic, type, goal, user?.id ?? null))
  );

  const synthesisRes = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 2048,
    system: AGENTS.executive.systemPrompt,
    messages: [
      {
        role: "user",
        content: `Goal: ${goal}\n\nSpecialist findings:\n${specialistResults
          .map((r) => `### ${r.name}\n${r.output}`)
          .join("\n\n")}\n\nSynthesize these into a prioritized report with clear recommendations.`,
      },
    ],
  });
  const report =
    synthesisRes.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")?.text ?? "";

  if (features.database && user) {
    const supabase = createServerSupabaseClient();
    const { data: agentRow } = await supabase
      .from("agents")
      .upsert(
        { user_id: user.id, type: "executive", name: AGENTS.executive.name, status: "idle" },
        { onConflict: "user_id,type" }
      )
      .select("id")
      .single();

    if (agentRow) {
      await supabase.from("agent_runs").insert({
        agent_id: agentRow.id,
        status: "success",
        input: { goal },
        output: { consulted: specialistTypes, report },
        finished_at: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({ consulted: specialistTypes, specialists: specialistResults, report });
}
