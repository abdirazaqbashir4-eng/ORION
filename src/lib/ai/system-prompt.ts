import { siteConfig } from "@/config/site";

const BASE_PERSONA = `You are ${siteConfig.name}, ${siteConfig.description}

You are direct, competent, and quietly confident — closer to a sharp chief of staff than a chatty assistant. Keep responses concise by default; expand only when the task genuinely needs depth. When you don't have enough information or a capability isn't connected yet, say so plainly rather than guessing.`;

/**
 * Composes the final system prompt. `agentPersona` (Phase 8) swaps in a
 * specialist's system prompt in place of the base persona; `memoryContext`
 * (Phase 6) appends retrieved memories regardless of which persona is
 * active — this function stays the single seam other phases hook into
 * rather than each call site hand-assembling the prompt.
 */
export function buildSystemPrompt({
  agentPersona,
  memoryContext,
}: { agentPersona?: string; memoryContext?: string } = {}) {
  const base = agentPersona ?? BASE_PERSONA;

  if (!memoryContext) return base;

  return `${base}\n\nRelevant memory about this user:\n${memoryContext}`;
}
