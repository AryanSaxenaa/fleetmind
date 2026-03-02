"use client";

import { useChat } from "ai/react";
import { useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  RefreshCw,
  AlertTriangle,
  PlusCircle,
  Image,
} from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { QuickActions } from "./QuickActions";
import { VoiceInput } from "./VoiceInput";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

export function ChatPanel() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    append,
    error,
    reload,
  } = useChat({
    api: "/api/chat",
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuickAction = (prompt: string) => {
    append({ role: "user", content: prompt });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-6 md:px-10 py-8 space-y-6 scrollbar-thin"
      >
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto">
            {/* Welcome illustration placeholder */}
            <div className="h-40 mb-8 illustration-placeholder rounded-lg">
              <Image className="h-6 w-6 opacity-40" />
            </div>

            <h2 className="font-editorial text-2xl font-bold text-primary mb-2">
              {getGreeting()}
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-6">
              I&apos;m your AI fleet copilot. Ask me anything — try
              &quot;Morning briefing&quot; or &quot;Who needs coaching?&quot;
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  handleQuickAction("Give me a morning briefing for today")
                }
                className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-dark transition-colors"
              >
                Morning Briefing
              </button>
              <button
                onClick={() =>
                  handleQuickAction(
                    "Show me driver safety rankings this week"
                  )
                }
                className="px-4 py-2 rounded-lg border border-border text-primary text-xs font-semibold hover:bg-cream transition-colors"
              >
                Safety Report
              </button>
              <button
                onClick={() =>
                  handleQuickAction(
                    "Show me Driver DNA profiles for my top 5 drivers"
                  )
                }
                className="px-4 py-2 rounded-lg border border-border text-primary text-xs font-semibold hover:bg-cream transition-colors"
              >
                Driver DNA
              </button>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex gap-4 max-w-3xl">
            <div className="size-8 rounded-lg bg-cream border border-border flex items-center justify-center shrink-0">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
            <div className="ai-bubble p-5 rounded-lg rounded-tl-none flex-1">
              <div className="space-y-2">
                <div className="h-3 w-3/4 rounded bg-cream animate-shimmer" />
                <div className="h-3 w-1/2 rounded bg-cream animate-shimmer" />
                <div className="h-3 w-2/3 rounded bg-cream animate-shimmer" />
              </div>
            </div>
          </div>
        )}

        {/* Error state with retry */}
        {error && (
          <div className="flex items-start gap-3 my-4 p-4 border border-border rounded-lg max-w-3xl bg-white">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">
                Something went wrong
              </p>
              <p className="text-xs text-muted mt-1">
                {error.message ||
                  "Failed to get a response. Please try again."}
              </p>
            </div>
            <button
              onClick={() => reload()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary border border-border hover:bg-cream rounded-lg transition-colors shrink-0"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {messages.length > 0 && <QuickActions onAction={handleQuickAction} />}

      {/* Input */}
      <div className="px-6 md:px-10 pb-6 pt-2 relative z-10">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto border border-border rounded-lg bg-white p-1.5 flex items-center"
        >
          <button
            type="button"
            className="size-10 rounded-lg flex items-center justify-center text-muted hover:text-primary transition-colors shrink-0"
          >
            <PlusCircle className="h-5 w-5" />
          </button>
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your fleet command here..."
            aria-label="Type a fleet question"
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-primary placeholder:text-muted text-sm min-w-0"
            disabled={isLoading}
          />
          <div className="flex items-center gap-1 pr-1 shrink-0">
            <VoiceInput
              onTranscript={(text) =>
                append({ role: "user", content: text })
              }
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              className="size-10 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-dark transition-colors disabled:opacity-30 disabled:hover:bg-primary"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
        <p className="text-center mt-3 text-[10px] text-muted font-medium tracking-widest uppercase">
          Secured by FleetMind AI Guard · Real-time Sync Active
        </p>
      </div>
    </div>
  );
}
