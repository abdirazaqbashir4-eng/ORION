"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GenerateBriefingButton() {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/briefing/generate", { method: "POST" });
      if (!res.ok) throw new Error();
      startTransition(() => router.refresh());
    } catch {
      toast.error("Couldn't generate the briefing.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="secondary"
      disabled={loading || isPending}
      onClick={() => void handleClick()}
      className="gap-1.5"
    >
      <RefreshCw className={loading || isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      Generate briefing now
    </Button>
  );
}
