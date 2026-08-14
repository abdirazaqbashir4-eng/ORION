/**
 * Hand-written row types mirroring `supabase/migrations`. Once the schema
 * stabilizes, replace this with generated types:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
 */

export type MemoryType =
  | "conversation"
  | "preference"
  | "note"
  | "task"
  | "business"
  | "learning"
  | "goal"
  | "project";

export type AgentType = "developer" | "business" | "marketing" | "research" | "executive";

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  agent_type: "general" | AgentType;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls: unknown | null;
  tool_results: unknown | null;
  attachments: unknown[];
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  type: MemoryType;
  content: string;
  summary: string | null;
  embedding: number[] | null;
  importance: number;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  agent_type: AgentType | null;
  parent_task_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Agent {
  id: string;
  user_id: string | null;
  name: string;
  type: AgentType;
  description: string | null;
  status: "idle" | "running" | "error" | "disabled";
  config: Record<string, unknown>;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Briefing {
  id: string;
  user_id: string;
  briefing_date: string;
  summary: string | null;
  emails_summary: Record<string, unknown>;
  revenue_summary: Record<string, unknown>;
  calendar_summary: Record<string, unknown>;
  news_summary: Record<string, unknown>;
  tasks_summary: Record<string, unknown>;
  recommendations: unknown[];
  created_at: string;
}

export interface Automation {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  trigger_type: "schedule" | "event" | "manual";
  schedule_cron: string | null;
  event_name: string | null;
  action_type: string;
  action_config: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessMetric {
  id: string;
  user_id: string;
  metric_date: string;
  revenue: number;
  expenses: number;
  profit: number;
  currency: string;
  product: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "info" | "success" | "warning" | "error" | "action_required";
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}
