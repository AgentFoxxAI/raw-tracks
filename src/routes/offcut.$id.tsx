import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Layers, MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { AudioPlayer } from "@/components/AudioPlayer";
import { InstrumentBadge, LicenseBadge } from "@/components/InstrumentBadge";
import { OffcutCard, type OffcutCardData } from "@/components/OffcutCard";
import { formatDuration } from "@/lib/instrument";

export const Route = createFileRoute("/offcut/$id")({
  component: OffcutDetail,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

interface FullOffcut extends OffcutCardData {
  user_id: string;
}

interface Interaction {
  id: string;
  user_id: string;
  type: string;
  content: string | null;
  timestamp_ref: number | null;
  created_at: string;
  profile?: { username: string | null } | null;
}

function OffcutDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [offcut, setOffcut] = useState<FullOffcut | null>(null);
  const [stacks, setStacks] = useState<OffcutCardData[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [commentText, setCommentText] = useState("");
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionTime, setSuggestionTime] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: o } = await supabase
      .from("offcuts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!o) {
      setOffcut(null);
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("id,username,avatar_url")
      .eq("id", o.user_id)
      .maybeSingle();
    setOffcut({
      ...o,
      waveform_data: (o.waveform_data as number[] | null) ?? null,
      profile: prof ?? null,
    } as FullOffcut);

    // Stacks (children)
    const { data: stackRows } = await supabase
      .from("stacks")
      .select("child_offcut_id")
      .eq("parent_offcut_id", id);
    const childIds = (stackRows ?? []).map((s) => s.child_offcut_id);
    if (childIds.length > 0) {
      const { data: kids } = await supabase
        .from("offcuts")
        .select("id,title,description,audio_url,duration_seconds,instrument_tag,license_type,waveform_data,play_count,created_at,user_id")
        .in("id", childIds)
        .order("created_at", { ascending: false });
      const userIds = Array.from(new Set((kids ?? []).map((k) => k.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      setStacks(
        (kids ?? []).map((k) => ({
          ...k,
          waveform_data: (k.waveform_data as number[] | null) ?? null,
          profile: profMap.get(k.user_id) ?? null,
        })),
      );
    } else {
      setStacks([]);
    }

    // Interactions
    const { data: ints } = await supabase
      .from("interactions")
      .select("id,user_id,type,content,timestamp_ref,created_at")
      .eq("offcut_id", id)
      .order("created_at", { ascending: true });
    if (ints && ints.length > 0) {
      const { data: profs2 } = await supabase
        .from("profiles")
        .select("id,username")
        .in("id", Array.from(new Set(ints.map((i) => i.user_id))));
      const m = new Map((profs2 ?? []).map((p) => [p.id, p]));
      setInteractions(
        ints.map((i) => ({ ...i, profile: m.get(i.user_id) ?? null })),
      );
    } else {
      setInteractions([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onPlayed = () => {
    if (!offcut) return;
    void supabase.rpc("increment_play_count", { offcut_id_input: offcut.id });
  };

  const postInteraction = async (type: "comment" | "suggestion") => {
    if (!user || !offcut) return;
    const content = type === "comment" ? commentText.trim() : suggestionText.trim();
    if (!content) return;
    setPosting(true);
    const { error } = await supabase.from("interactions").insert({
      offcut_id: offcut.id,
      user_id: user.id,
      type,
      content,
      timestamp_ref:
        type === "suggestion" && suggestionTime ? parseFloat(suggestionTime) : null,
    });
    setPosting(false);
    if (!error) {
      if (type === "comment") setCommentText("");
      else {
        setSuggestionText("");
        setSuggestionTime("");
      }
      void load();
    }
  };

  const handleDownload = () => {
    if (!offcut || !user) return;
    const isPro = profile?.tier === "paid";
    void supabase.from("downloads").insert({
      offcut_id: offcut.id,
      user_id: user.id,
      format: isPro ? "wav" : "mp3",
    });
    window.open(offcut.audio_url, "_blank");
  };

  if (loading) {
    return (
      <AppShell>
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </AppShell>
    );
  }
  if (!offcut) {
    return (
      <AppShell>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-bold">Offcut not found.</p>
          <Link to="/feed" className="mt-3 inline-block text-primary">
            Back to feed
          </Link>
        </div>
      </AppShell>
    );
  }

  const isPro = profile?.tier === "paid";

  return (
    <AppShell>
      <button
        onClick={() => router.history.back()}
        className="label-tape mb-3 text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">@{offcut.profile?.username ?? "anon"}</span>
              <span className="label-tape text-muted-foreground">
                {formatDuration(offcut.duration_seconds)}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black leading-tight">{offcut.title}</h1>
          </div>
        </div>

        <div className="mt-5">
          <AudioPlayer
            url={offcut.audio_url}
            waveformData={offcut.waveform_data}
            duration={offcut.duration_seconds}
            size="lg"
            onFirstPlay={onPlayed}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <InstrumentBadge tag={offcut.instrument_tag} />
          <LicenseBadge license={offcut.license_type} />
          <span className="label-tape ml-auto text-muted-foreground">
            {offcut.play_count} plays
          </span>
        </div>

        {offcut.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {offcut.description}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            to="/upload"
            search={{ parent: offcut.id }}
            className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
          >
            <Layers size={16} /> Stack on this
          </Link>
          <button
            onClick={handleDownload}
            className="relative flex items-center justify-center gap-2 rounded-md border border-border bg-surface-elevated px-4 py-3 text-sm font-bold hover:border-primary/50"
          >
            <Download size={16} />
            {isPro ? "Download WAV" : "Download MP3"}
            {!isPro && (
              <span className="label-tape absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
                Pro: WAV
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stacks */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-primary" />
          <h2 className="font-bold">Stacked on this ({stacks.length})</h2>
        </div>
        {stacks.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border bg-surface p-5 text-center text-sm text-muted-foreground">
            Nothing stacked yet. Be first.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {stacks.map((s) => (
              <OffcutCard key={s.id} offcut={s} />
            ))}
          </div>
        )}
      </section>

      {/* Interactions */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-primary" />
          <h2 className="font-bold">Comments & suggestions</h2>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <p className="label-tape text-muted-foreground">Comment</p>
          <div className="mt-2 flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="What did you think?"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              disabled={posting || !commentText.trim()}
              onClick={() => postInteraction("comment")}
              className="rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>

          <p className="label-tape mt-4 text-muted-foreground">Suggestion (with timestamp)</p>
          <div className="mt-2 flex gap-2">
            <input
              value={suggestionTime}
              onChange={(e) => setSuggestionTime(e.target.value)}
              placeholder="0:42"
              className="w-20 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <input
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="Try a 7th here?"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              disabled={posting || !suggestionText.trim()}
              onClick={() => postInteraction("suggestion")}
              className="rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {interactions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            interactions.map((i) => (
              <div key={i.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">@{i.profile?.username ?? "anon"}</span>
                  <span
                    className={
                      "label-tape rounded-full border px-2 py-0.5 " +
                      (i.type === "suggestion"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground")
                    }
                  >
                    {i.type}
                    {i.timestamp_ref != null
                      ? ` · ${formatDuration(i.timestamp_ref)}`
                      : ""}
                  </span>
                </div>
                <p className="mt-1.5 text-sm">{i.content}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
