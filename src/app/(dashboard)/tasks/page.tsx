import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TaskCheckbox } from "@/components/dashboard/task-checkbox";
import { AutomationsPanel } from "@/components/dashboard/automations-panel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTask } from "./actions";
import type { Task } from "@/lib/supabase/types";

const priorityStyles: Record<Task["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-orion-cyan/15 text-orion-cyan",
  high: "bg-orion-warning/15 text-orion-warning",
  urgent: "bg-orion-danger/15 text-orion-danger",
};

export default async function TasksPage() {
  if (!features.database) {
    return (
      <TasksShell>
        <EmptyState
          icon={ListChecks}
          title="No tasks tracked yet"
          description="Connect Supabase (see /system) to start tracking tasks, automations, and agent activity here."
          phase="Phase 3"
        />
      </TasksShell>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return (
      <TasksShell>
        <EmptyState
          icon={ListChecks}
          title="Sign in to see your tasks"
          description="Task tracking is scoped per account — sign in to create and view tasks."
          phase="Phase 2"
        />
      </TasksShell>
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (
    <TasksShell>
      <form action={createTask} className="glass-panel flex gap-2 rounded-xl p-3">
        <Input
          name="title"
          placeholder="Add a task…"
          className="border-white/10 bg-white/5 focus-visible:ring-orion-cyan/40"
        />
        <Button type="submit" className="bg-orion-cyan text-orion-cyan-foreground hover:bg-orion-cyan/90">
          Add
        </Button>
      </form>

      {tasks && tasks.length > 0 ? (
        <ul className="glass-panel divide-y divide-glass-border rounded-xl">
          {(tasks as Task[]).map((task) => (
            <li key={task.id} className="flex items-center gap-3 px-4 py-3">
              <TaskCheckbox taskId={task.id} completed={task.status === "completed"} />
              <span
                className={cn(
                  "flex-1 text-sm",
                  task.status === "completed" && "text-muted-foreground line-through"
                )}
              >
                {task.title}
              </span>
              <Badge variant="secondary" className={cn("text-[10px]", priorityStyles[task.priority])}>
                {task.priority}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          description="Add your first task above, or let an ORION agent create one from a conversation."
          phase="Phase 8"
        />
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Automations</h2>
        <AutomationsPanel />
      </div>
    </TasksShell>
  );
}

function TasksShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold glow-text">Task Center</h1>
        <p className="text-sm text-muted-foreground">
          Current tasks, scheduled automations, and agent activity.
        </p>
      </div>
      {children}
    </div>
  );
}
