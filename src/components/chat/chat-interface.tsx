"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowUp, Paperclip, X, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AGENT_LIST } from "@/lib/agents/registry";
import type { AgentType } from "@/lib/agents/types";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface PendingAttachment {
  id: string;
  name: string;
  mediaType: string;
  data: string; // base64, no data: prefix
  previewUrl: string;
}

type SelectedAgent = "general" | AgentType;

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function fileToAttachment(file: File): Promise<PendingAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        mediaType: file.type,
        data: base64,
        previewUrl: result,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentType, setAgentType] = useState<SelectedAgent>("general");
  const [, startTransition] = useTransition();
  const conversationId = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  function handleAgentChange(value: string | null) {
    if (!value) return;
    setAgentType(value as SelectedAgent);
    conversationId.current = null; // switching persona starts a fresh thread
    setMessages([]);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const accepted = Array.from(files).filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
    if (accepted.length !== files.length) {
      toast.error("Only JPEG, PNG, GIF, or WebP images are supported.");
    }
    const converted = await Promise.all(accepted.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...converted].slice(0, 5));
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);
    setIsStreaming(true);
    requestAnimationFrame(scrollToBottom);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId.current,
          message: trimmed,
          agentType,
          attachments: sentAttachments.map((a) => ({ mediaType: a.mediaType, data: a.data })),
        }),
      });

      if (!res.ok || !res.body) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error?.message ?? errorBody?.error ?? `Request failed (${res.status})`);
      }

      const newConversationId = res.headers.get("X-Conversation-Id");
      if (newConversationId) conversationId.current = newConversationId;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
        );
        scrollToBottom();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleOrchestrate() {
    const goal = input.trim();
    if (!goal || isStreaming) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: goal };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "Consulting specialists…" },
    ]);
    setInput("");
    setIsStreaming(true);
    requestAnimationFrame(scrollToBottom);

    try {
      const res = await fetch("/api/agents/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      if (!res.ok) throw new Error(`Orchestration failed (${res.status})`);
      const data = (await res.json()) as { consulted: string[]; report: string };

      const header = `Consulted: ${data.consulted.join(", ")}\n\n`;
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: header + data.report } : m))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Orchestration failed.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      scrollToBottom();
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <Select value={agentType} onValueChange={handleAgentChange}>
          <SelectTrigger className="border-white/10 bg-white/5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">ORION (general)</SelectItem>
            {AGENT_LIST.map((agent) => (
              <SelectItem key={agent.type} value={agent.type}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1 pr-2">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
            <p className="glow-text text-lg font-medium">How can I help?</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {agentType === "general"
                ? "Ask ORION anything — it streams responses directly from Claude."
                : AGENT_LIST.find((a) => a.type === agentType)?.shortDescription}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                    m.role === "user"
                      ? "bg-orion-cyan/15 text-foreground"
                      : "glass-panel text-foreground"
                  )}
                >
                  {m.content || (isStreaming && m.role === "assistant" ? "…" : "")}
                </div>
              </div>
            ))}
            <div ref={scrollAnchorRef} />
          </div>
        )}
      </ScrollArea>

      <div className="glass-panel rounded-xl p-3">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <div key={a.id} className="relative h-14 w-14 overflow-hidden rounded-lg border border-glass-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.previewUrl} alt={a.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach image"
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-orion-cyan"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            multiple
            className="hidden"
            onChange={(e) => startTransition(() => void handleFiles(e.target.files))}
          />

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={agentType === "executive" ? "Describe a goal for the Executive Agent…" : "Message ORION…"}
            rows={1}
            className="max-h-40 min-h-9 flex-1 resize-none border-white/10 bg-white/5 focus-visible:ring-orion-cyan/40"
          />

          {agentType === "executive" && (
            <Button
              type="button"
              variant="secondary"
              disabled={!input.trim() || isStreaming}
              onClick={() => void handleOrchestrate()}
              className="gap-1.5"
            >
              <Users className="h-4 w-4" />
              Ask all agents
            </Button>
          )}

          <Button
            type="button"
            size="icon"
            disabled={!input.trim() || isStreaming}
            onClick={() => void handleSend()}
            className="bg-orion-cyan text-orion-cyan-foreground hover:bg-orion-cyan/90"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
