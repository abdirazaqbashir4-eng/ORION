"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("tasks").insert({ user_id: user.id, title });
  if (error) throw error;

  revalidatePath("/tasks");
}

export async function toggleTaskStatus(taskId: string, completed: boolean) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      status: completed ? "completed" : "pending",
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  if (error) throw error;

  revalidatePath("/tasks");
}
