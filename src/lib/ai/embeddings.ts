import "server-only";
import OpenAI from "openai";
import { env, features } from "@/lib/env";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

export async function embedText(text: string): Promise<number[]> {
  if (!features.embeddings) {
    throw new Error("Embeddings are not configured. Set OPENAI_API_KEY.");
  }
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return res.data[0].embedding;
}
