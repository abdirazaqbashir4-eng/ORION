import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ChatInterface } from "@/components/chat/chat-interface";
import { features } from "@/lib/env";

export default function ChatPage() {
  if (!features.ai) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold glow-text">AI Chat</h1>
          <p className="text-sm text-muted-foreground">
            Streaming conversation with ORION, with memory and tool use.
          </p>
        </div>
        <EmptyState
          icon={MessagesSquare}
          title="Chat isn't connected yet"
          description="Set ANTHROPIC_API_KEY in .env.local to enable streaming chat."
          phase="Phase 5"
        />
      </div>
    );
  }

  return <ChatInterface />;
}
