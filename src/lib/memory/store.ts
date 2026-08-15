import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/ai/embeddings";
import type { Memory, MemoryType } from "@/lib/supabase/types";

interface SaveMemoryInput {
  type: MemoryType;
  content: string;
  summary?: string;
  importance?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

export async function saveMemory(userId: string, input: SaveMemoryInput): Promise<Memory> {
  const supabase = createServerSupabaseClient();
  const embedding = await embedText(input.content);

  const { data, error } = await supabase
    .from("memories")
    .insert({
      user_id: userId,
      type: input.type,
      content: input.content,
      summary: input.summary ?? null,
      embedding,
      importance: input.importance ?? 5,
      source: input.source ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Memory;
}

interface RankedMemory {
  id: string;
  content: string;
  summary: string | null;
  type: MemoryType;
  importance: number;
  similarity: number;
}

/** Semantic search over a user's memories, ranked by cosine similarity. */
export async function searchMemories(
  userId: string,
  query: string,
  opts: { limit?: number; threshold?: number } = {}
): Promise<RankedMemory[]> {
  const supabase = createServerSupabaseClient();
  const embedding = await embedText(query);

  const { data, error } = await supabase.rpc("match_memories", {
    query_embedding: embedding,
    match_user_id: userId,
    match_count: opts.limit ?? 8,
    match_threshold: opts.threshold ?? 0.75,
  });

  if (error) throw error;
  return data as RankedMemory[];
}

export async function listRecentMemories(userId: string, limit = 20): Promise<Memory[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Memory[];
}
