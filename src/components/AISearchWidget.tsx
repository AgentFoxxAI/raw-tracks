import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Play, Loader2 } from "lucide-react";
import {
  AI_SEARCH_PROMPTS,
  mockAISearchAnswer,
  type AIMockResult,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface ChatMsg {
  id: string;
  from: "me" | "ai";
  text: string;
  results?: AIMockResult[];
}

/** Floating bottom-right AI search chatbot — mocked for demo. */
export function AISearchWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "intro",
      from: "ai",
      text: "Hey — ask me anything about your audio notes. I can find riffs by tag, surface duplicates, or pull up demos with no comments yet.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const ask = (q: string) => {
    if (!q.trim() || busy) return;
    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      from: "me",
      text: q.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    // Simulate latency for demo realism
    window.setTimeout(() => {
      const { summary, results } = mockAISearchAnswer(q.trim());
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          from: "ai",
          text: summary,
          results,
        },
      ]);
      setBusy(false);
    }, 700);
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-50 flex h-14 items-center gap-2 rounded-full bg-primary px-4 text-primary-foreground shadow-xl shadow-primary/30 transition-transform hover:scale-105"
          aria-label="Open AI search"
        >
          <Sparkles size={18} />
          <span className="text-sm font-bold">AI Search</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-2 bottom-20 z-50 mx-auto flex max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60 sm:inset-x-auto sm:right-4 sm:bottom-24 sm:w-96">
          <header className="flex items-center justify-between border-b border-border bg-surface-elevated px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles size={14} />
              </span>
              <div>
                <p className="text-sm font-bold">AI Search</p>
                <p className="label-tape text-muted-foreground">demo · your audio notes</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </header>

          <div ref={scrollRef} className="max-h-[55vh] flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      m.from === "me"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground border border-border",
                    )}
                  >
                    <p>{m.text}</p>
                    {m.results && m.results.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {m.results.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5"
                          >
                            <button
                              type="button"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/90 text-primary-foreground"
                              aria-label="Play"
                            >
                              <Play size={12} className="ml-0.5" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-foreground">
                                {r.title}
                              </p>
                              <p className="label-tape truncate text-muted-foreground">
                                {r.meta}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" />
                    Searching your library…
                  </div>
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="mt-4">
                <p className="label-tape mb-2 text-muted-foreground">Try one:</p>
                <div className="flex flex-wrap gap-1.5">
                  {AI_SEARCH_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => ask(p)}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground/80 hover:border-primary/50 hover:text-primary"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2 border-t border-border bg-surface-elevated p-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your audio notes…"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
