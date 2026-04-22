import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Play, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { Waveform } from "@/components/Waveform";
import { InstrumentBadge } from "@/components/InstrumentBadge";
import { SocialActions } from "@/components/SocialActions";
import { ActivePlayer } from "@/lib/active-player";
import { formatDuration } from "@/lib/instrument";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/post/$id")({
  component: PostDetail,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

interface FullPost {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  media_type: "audio" | "video";
  media_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  instrument_tag: string;
  visibility: string;
  waveform_data: number[] | null;
  play_count: number;
  created_at: string;
  profile?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface CommentRow {
  id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  profile?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

interface ThreadNode extends CommentRow {
  replies: ThreadNode[];
}

function PostDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<FullPost | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [commentText, setCommentText] = useState("");
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playCounted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data: o } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!o) {
      setPost(null);
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .eq("id", o.user_id)
      .maybeSingle();
    setPost({
      id: o.id,
      user_id: o.user_id,
      title: o.title,
      description: o.description,
      media_type: ((o as { media_type?: string }).media_type as "audio" | "video") ?? "audio",
      media_url: (o as { media_url?: string }).media_url ?? o.audio_url,
      thumbnail_url: (o as { thumbnail_url?: string | null }).thumbnail_url ?? null,
      duration_seconds: o.duration_seconds,
      instrument_tag: o.instrument_tag,
      visibility: o.visibility,
      waveform_data: (o.waveform_data as number[] | null) ?? null,
      play_count: o.play_count,
      created_at: o.created_at,
      profile: prof
        ? {
            id: prof.id,
            username: prof.username,
            display_name: (prof as { display_name?: string | null }).display_name ?? prof.username,
            avatar_url: prof.avatar_url,
          }
        : null,
    });

    const { data: cs } = await supabase
      .from("comments")
      .select("id,user_id,parent_comment_id,content,created_at")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    if (cs && cs.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", Array.from(new Set(cs.map((c) => c.user_id))));
      const m = new Map((profs ?? []).map((p) => [p.id, p]));
      setComments(
        cs.map((c) => ({
          id: c.id,
          user_id: c.user_id,
          parent_comment_id: c.parent_comment_id,
          content: c.content,
          created_at: c.created_at,
          profile: m.has(c.user_id)
            ? {
                username: m.get(c.user_id)?.username ?? null,
                display_name:
                  (m.get(c.user_id) as { display_name?: string | null } | undefined)?.display_name ??
                  m.get(c.user_id)?.username ??
                  null,
                avatar_url: m.get(c.user_id)?.avatar_url ?? null,
              }
            : null,
        })),
      );
    } else {
      setComments([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // playback wiring (single player on detail; coordinates with feed via ActivePlayer)
  useEffect(() => {
    if (!post) return;
    ActivePlayer.set(null); // pause any feed cards
    const el = post.media_type === "video" ? videoRef.current : audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (el.duration > 0) setProgress(el.currentTime / el.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      el.currentTime = 0;
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
  }, [post]);

  const togglePlay = () => {
    const el = post?.media_type === "video" ? videoRef.current : audioRef.current;
    if (!el || !post) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
      if (!playCounted.current) {
        playCounted.current = true;
        void supabase.rpc("increment_play_count", { offcut_id_input: post.id });
      }
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const submitComment = async () => {
    if (!user || !post || !commentText.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: user.id,
      content: commentText.trim(),
      parent_comment_id: replyParentId,
    });
    setPosting(false);
    if (!error) {
      setCommentText("");
      setReplyParentId(null);
      void load();
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </AppShell>
    );
  }
  if (!post) {
    return (
      <AppShell>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-bold">Post not found.</p>
          <Link to="/feed" className="mt-3 inline-block text-primary">
            Back to feed
          </Link>
        </div>
      </AppShell>
    );
  }

  const username = post.profile?.username ?? "anon";
  const displayName = post.profile?.display_name ?? username;
  const initials = displayName.slice(0, 1).toUpperCase();

  // Build comment tree
  const tree = buildTree(comments);

  return (
    <AppShell>
      <button
        onClick={() => router.history.back()}
        className="label-tape mb-3 text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>

      <article className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <Link
            to="/u/$username"
            params={{ username }}
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-elevated text-base font-bold"
          >
            {post.profile?.avatar_url ? (
              <img src={post.profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </Link>
          <div className="min-w-0">
            <Link to="/u/$username" params={{ username }} className="block font-bold hover:underline">
              {displayName}
            </Link>
            <span className="text-xs text-muted-foreground">@{username}</span>
          </div>
        </div>

        <h1 className="mt-4 text-2xl font-black leading-tight">{post.title}</h1>

        {post.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {post.description}
          </p>
        )}

        {/* Media */}
        <div className="mt-4 overflow-hidden rounded-lg bg-background">
          {post.media_type === "video" ? (
            <div className="relative aspect-video w-full">
              <video
                ref={videoRef}
                src={post.media_url}
                poster={post.thumbnail_url ?? undefined}
                playsInline
                muted={muted}
                preload="metadata"
                className="h-full w-full object-cover"
                onClick={togglePlay}
              />
              {!playing && (
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-background/30"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground">
                    <Play size={28} className="ml-1" />
                  </span>
                </button>
              )}
              {playing && (
                <button
                  type="button"
                  onClick={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    v.muted = !v.muted;
                    setMuted(v.muted);
                  }}
                  className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 text-foreground"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              )}
            </div>
          ) : (
            <div className="px-4 py-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95",
                  )}
                >
                  <Play size={24} className="ml-0.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <Waveform
                    data={post.waveform_data}
                    progress={progress}
                    playing={playing}
                    height={64}
                    bars={72}
                  />
                  <div className="mt-1 flex justify-between label-tape text-muted-foreground">
                    <span>{post.media_type.toUpperCase()}</span>
                    <span>{formatDuration(post.duration_seconds)}</span>
                  </div>
                </div>
              </div>
              <audio ref={audioRef} src={post.media_url} preload="metadata" />
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <InstrumentBadge tag={post.instrument_tag} />
          <span className="label-tape text-muted-foreground">{post.play_count} plays</span>
        </div>

        <div className="mt-4 border-t border-border pt-2">
          <SocialActions postId={post.id} />
        </div>
      </article>

      {/* Comments */}
      <section className="mt-6">
        <h2 className="px-1 text-sm font-bold text-muted-foreground">
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </h2>

        <div className="mt-3 rounded-xl border border-border bg-surface p-3">
          {replyParentId && (
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Replying to comment</span>
              <button onClick={() => setReplyParentId(null)} className="text-primary">
                cancel
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={replyParentId ? "Add a reply..." : "Drop a comment..."}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitComment();
              }}
            />
            <button
              disabled={posting || !commentText.trim()}
              onClick={submitComment}
              className="rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {tree.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
              No comments yet. Be first.
            </p>
          ) : (
            tree.map((c) => (
              <CommentNode key={c.id} node={c} depth={0} onReply={(pid) => setReplyParentId(pid)} />
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}

function buildTree(rows: CommentRow[]): ThreadNode[] {
  const map = new Map<string, ThreadNode>();
  rows.forEach((r) => map.set(r.id, { ...r, replies: [] }));
  const roots: ThreadNode[] = [];
  rows.forEach((r) => {
    const node = map.get(r.id);
    if (!node) return;
    if (r.parent_comment_id && map.has(r.parent_comment_id)) {
      map.get(r.parent_comment_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function CommentNode({
  node,
  depth,
  onReply,
}: {
  node: ThreadNode;
  depth: number;
  onReply: (parentId: string) => void;
}) {
  const dn = node.profile?.display_name ?? node.profile?.username ?? "anon";
  const initials = dn.slice(0, 1).toUpperCase();
  return (
    <div className={cn(depth > 0 && "ml-4 border-l border-border pl-3")}>
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-elevated text-xs font-bold">
            {node.profile?.avatar_url ? (
              <img src={node.profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{dn}</span>
              <span className="text-xs text-muted-foreground">
                @{node.profile?.username ?? "anon"}
              </span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm">{node.content}</p>
            <button
              type="button"
              onClick={() => onReply(node.id)}
              className="mt-1 text-xs text-muted-foreground hover:text-primary"
            >
              Reply
            </button>
          </div>
        </div>
      </div>
      {node.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.replies.map((r) => (
            <CommentNode key={r.id} node={r} depth={depth + 1} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}
