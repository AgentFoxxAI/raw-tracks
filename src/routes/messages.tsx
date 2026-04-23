import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Inbox, Handshake, Send, Check, X, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MOCK_DMS, type MockDM } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

function MessagesPage() {
  const [dms, setDms] = useState<MockDM[]>(MOCK_DMS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const active = dms.find((d) => d.id === activeId) ?? null;

  const updateCollab = (id: string, status: "approved" | "declined") => {
    setDms((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              collab_status: status,
              thread: [
                ...d.thread,
                {
                  from: "me",
                  text:
                    status === "approved"
                      ? "Approved your collab request 🤝 — I'll share a stem next."
                      : "Going to pass on this one — thanks for reaching out.",
                  at: "now",
                },
              ],
            }
          : d,
      ),
    );
  };

  const sendMessage = () => {
    if (!active || !draft.trim()) return;
    setDms((prev) =>
      prev.map((d) =>
        d.id === active.id
          ? { ...d, thread: [...d.thread, { from: "me", text: draft.trim(), at: "now" }] }
          : d,
      ),
    );
    setDraft("");
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-2">
        <Inbox size={18} className="text-primary" />
        <p className="label-tape text-primary">Inbox · demo</p>
      </div>
      <h1 className="mb-1 text-2xl font-black">Messages</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Direct messages and collaboration requests from artists. (Mocked for the
        demo — wire to live data later.)
      </p>

      {!active ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {dms.map((d) => {
            const initials = d.artist.display_name.slice(0, 1).toUpperCase();
            return (
              <li key={d.id}>
                <button
                  onClick={() => setActiveId(d.id)}
                  className="flex w-full items-start gap-3 p-3 text-left hover:bg-surface-elevated"
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-base font-black text-primary-foreground">
                    {initials}
                    {d.unread && (
                      <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold">
                        {d.artist.display_name}
                      </span>
                      <span className="label-tape shrink-0 text-muted-foreground">
                        {d.time_ago}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      @{d.artist.username}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 line-clamp-2 text-sm",
                        d.unread ? "text-foreground" : "text-foreground/70",
                      )}
                    >
                      {d.preview}
                    </p>
                    {d.is_collab_request && (
                      <CollabBadge status={d.collab_status ?? "pending"} />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <Conversation
          dm={active}
          draft={draft}
          setDraft={setDraft}
          onBack={() => setActiveId(null)}
          onSend={sendMessage}
          onCollab={(s) => updateCollab(active.id, s)}
        />
      )}
    </AppShell>
  );
}

function CollabBadge({ status }: { status: "pending" | "approved" | "declined" }) {
  const map = {
    pending: { label: "Collab request", cls: "border-primary/40 bg-primary/10 text-primary" },
    approved: {
      label: "Collab approved",
      cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    },
    declined: { label: "Declined", cls: "border-border bg-background text-muted-foreground" },
  } as const;
  const m = map[status];
  return (
    <span
      className={cn(
        "label-tape mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        m.cls,
      )}
    >
      <Handshake size={10} /> {m.label}
    </span>
  );
}

function Conversation({
  dm,
  draft,
  setDraft,
  onBack,
  onSend,
  onCollab,
}: {
  dm: MockDM;
  draft: string;
  setDraft: (s: string) => void;
  onBack: () => void;
  onSend: () => void;
  onCollab: (s: "approved" | "declined") => void;
}) {
  const initials = dm.artist.display_name.slice(0, 1).toUpperCase();
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border p-3">
        <button
          onClick={onBack}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{dm.artist.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">@{dm.artist.username}</p>
        </div>
      </div>

      {dm.is_collab_request && dm.collab_status === "pending" && (
        <div className="m-3 rounded-lg border border-primary/40 bg-primary/10 p-3">
          <p className="text-sm font-bold text-foreground">Collaboration request</p>
          <p className="mt-1 text-xs text-foreground/80">
            {dm.artist.display_name} wants to collaborate. If you approve, you'll be
            able to share a stem from your original audio with them only.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onCollab("approved")}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
            >
              <Check size={12} /> Approve & share stem
            </button>
            <button
              onClick={() => onCollab("declined")}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <X size={12} /> Decline
            </button>
          </div>
        </div>
      )}

      {dm.is_collab_request && dm.collab_status === "approved" && (
        <div className="m-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          ✓ Collab approved. Stem <span className="font-mono">midday-fog_stem.wav</span> shared
          with @{dm.artist.username} only.
        </div>
      )}

      <div className="space-y-2 p-3">
        {dm.thread.map((msg, idx) => (
          <div
            key={idx}
            className={cn("flex", msg.from === "me" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                msg.from === "me"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-foreground",
              )}
            >
              {msg.text}
              <p className="label-tape mt-0.5 opacity-60">{msg.at}</p>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
