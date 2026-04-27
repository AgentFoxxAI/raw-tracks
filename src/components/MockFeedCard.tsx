import { useMemo, useState } from "react";
import { Play, Pause, Heart, MessageCircle, Repeat2, Share, Sparkles, MoreHorizontal } from "lucide-react";
import { Waveform } from "./Waveform";
import { InstrumentBadge } from "./InstrumentBadge";
import { MetadataPanel } from "./MetadataPanel";
import { fakeWaveform, type MockFeedPost } from "@/lib/mock-data";
import { formatDuration } from "@/lib/instrument";
import { mockMetadataFromSeed } from "@/lib/audio-analysis";
import { cn } from "@/lib/utils";

interface Props {
  post: MockFeedPost;
}

export function MockFeedCard({ post }: Props) {
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [scrubProgress, setScrubProgress] = useState(0);

  const wave = fakeWaveform(post.waveform_seed);
  const initials = (post.artist.display_name ?? "?").slice(0, 1).toUpperCase();
  const metadata = useMemo(
    () => (post.kind === "audio" ? mockMetadataFromSeed(post.waveform_seed || 1, post.duration_seconds) : null),
    [post.waveform_seed, post.duration_seconds, post.kind],
  );

  const toggleLike = () => {
    setLiked((v) => {
      setLikeCount((c) => c + (v ? -1 : 1));
      return !v;
    });
  };

  return (
    <article className="rounded-xl border border-border bg-surface p-4 transition-colors">
      {/* Reason chip (X-style "Liked by", "Suggested for you") */}
      {post.reason !== "following" && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {post.reason === "suggested" ? (
            <>
              <Sparkles size={12} className="text-primary" />
              <span>Suggested for you</span>
            </>
          ) : (
            <>
              <Heart size={12} className="text-primary" />
              <span>Liked by @{post.liked_by?.username}</span>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        {post.artist.avatar_url ? (
          <img
            src={post.artist.avatar_url}
            alt={post.artist.display_name}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-sm font-bold">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold">{post.artist.display_name}</span>
            <span className="truncate text-xs text-muted-foreground">@{post.artist.username}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="label-tape text-muted-foreground">{relativeTime(post.created_at)}</span>
            <span className="label-tape ml-auto rounded-full border border-border bg-background px-1.5 text-muted-foreground">
              demo
            </span>
          </div>
          {post.title && (
            <p className="mt-0.5 truncate text-base font-bold leading-tight">{post.title}</p>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
          aria-label="More"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Audio media */}
      {post.kind === "audio" && (
        <div className="relative mt-3 overflow-hidden rounded-lg bg-background">
          <div className="px-4 py-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <Waveform data={wave} progress={playing ? 0.4 : 0} playing={playing} height={48} bars={56} />
                <div className="mt-1 flex items-center justify-between label-tape text-muted-foreground">
                  <span>AUDIO</span>
                  <span>{formatDuration(post.duration_seconds)}</span>
                </div>
              </div>
            </div>
          </div>
          {metadata && (
            <div className="border-t border-border p-2">
              <MetadataPanel metadata={metadata} variant="full" autoDetected />
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {post.description && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {post.description}
        </p>
      )}

      {/* Tags */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <InstrumentBadge tag={post.instrument_tag} />
        {post.kind === "audio" && (
          <span className="label-tape text-muted-foreground">{post.play_count.toLocaleString()} plays</span>
        )}
      </div>

      {/* X-style action row */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-muted-foreground">
        <ActionBtn icon={<MessageCircle size={16} />} label={String(post.comment_count)} />
        <ActionBtn
          icon={<Repeat2 size={16} />}
          label={String(post.repost_count + (reposted ? 1 : 0))}
          active={reposted}
          activeColor="text-emerald-500"
          onClick={() => setReposted((v) => !v)}
        />
        <ActionBtn
          icon={<Heart size={16} className={liked ? "fill-current" : ""} />}
          label={likeCount.toLocaleString()}
          active={liked}
          activeColor="text-rose-500"
          onClick={toggleLike}
        />
        <ActionBtn icon={<Share size={16} />} label="" />
      </div>
    </article>
  );
}

function ActionBtn({
  icon,
  label,
  active,
  activeColor,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  activeColor?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors hover:text-foreground",
        active && activeColor,
      )}
    >
      {icon}
      {label && <span className="tabular-nums">{label}</span>}
    </button>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
