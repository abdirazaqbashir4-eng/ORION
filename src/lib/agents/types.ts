export type AgentType = "developer" | "business" | "marketing" | "research" | "executive";

export interface AgentDefinition {
  type: AgentType;
  name: string;
  shortDescription: string;
  systemPrompt: string;
}
