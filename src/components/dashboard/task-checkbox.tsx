"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleTaskStatus } from "@/app/(dashboard)/tasks/actions";

export function TaskCheckbox({ taskId, completed }: { taskId: string; completed: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label={completed ? "Mark task incomplete" : "Mark task complete"}
      disabled={isPending}
      onClick={() => startTransition(() => toggleTaskStatus(taskId, !completed))}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
        completed
          ? "border-orion-success bg-orion-success/20 text-orion-success"
          : "border-white/20 text-transparent hover:border-orion-cyan/60",
        isPending && "opacity-50"
      )}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );
}
