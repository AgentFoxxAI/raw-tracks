import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX, Lock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ActivePlayer } from "@/lib/active-player";
import { Waveform } from "./Waveform";
import { InstrumentBadge } from "./InstrumentBadge";
import { SocialActions } from "./SocialActions";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/instrument";

export interface PostCardData {
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
    id?: string;
    username: string | null;
    display_name?: string | null;
    avatar_url: string | null;
  } | null;
}

interface Props {
  post: PostCardData;
  /** When true, autoplays when scrolled into view (feed). When false, requires tap (detail). */
  autoplayOnVisible?: boolean;
}

const LONG_PRESS_MS = 600;

export function PostCard({ post, autoplayOnVisible = true }: Props) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const playCounted = useRef(false);

  const [isActive, setIsActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const mediaEl = (): HTMLMediaElement | null =>
    post.media_type === "video" ? videoRef.current : audioRef.current;

  // Subscribe to active-player coordinator
  useEffect(() => {
    return ActivePlayer.subscribe((id) => {
      setIsActive(id === post.id);
      if (id !== post.id) {
        const el = mediaEl();
        if (el) {
          el.pause();
          el.currentTime = 0;
        }
        setPlaying(false);
        setProgress(0);
        playCounted.current = false;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  // Autoplay on scroll-into-view
  useEffect(() => {
    if (!autoplayOnVisible || !containerRef.current) return;
    const el = containerRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          ActivePlayer.set(post.id);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [post.id, autoplayOnVisible]);

  // Drive playback when this card becomes active
  useEffect(() => {
    const el = mediaEl();
    if (!el) return;
    if (isActive) {
      el.muted = muted || post.media_type === "video"; // video starts muted by browser autoplay rules
      const p = el.play();
      if (p) {
        p.then(() => setPlaying(true)).catch(() => {
          // autoplay blocked; user must tap
          setPlaying(false);
        });
      }
      if (!playCounted.current) {
        playCounted.current = true;
        void supabase.rpc("increment_play_count", { offcut_id_input: post.id });
      }
    } else {
      el.pause();
      setPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Track progress
  useEffect(() => {
    const el = mediaEl();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.media_type]);

  // Tap = play/unmute. Long-press (>600ms) = mute.
  const handlePointerDown = () => {
    longPressTimer.current = window.setTimeout(() => {
      const el = mediaEl();
      if (el) {
        el.muted = true;
        setMuted(true);
      }
      longPressTimer.current = null;
    }, LONG_PRESS_MS);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      // Treated as tap
      e.preventDefault();
      handleTap();
    }
  };
  const handlePointerLeave = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTap = () => {
    const el = mediaEl();
    if (!el) return;
    if (!isActive) {
      ActivePlayer.set(post.id);
      return;
    }
    if (el.muted) {
      el.muted = false;
      setMuted(false);
      if (el.paused) void el.play();
      return;
    }
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const goToPost = () =>
    navigate({ to: "/post/$id", params: { id: post.id } });

  const username = post.profile?.username ?? "anon";
  const displayName = post.profile?.display_name ?? username;
  const initials = (displayName ?? "?").slice(0, 1).toUpperCase();

  return (
    <article
      ref={containerRef}
      className="rounded-xl border border-border bg-surface p-4 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          to="/u/$username"
          params={{ username }}
          onClick={(e) => e.stopPropagation()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-sm font-bold text-foreground hover:ring-2 hover:ring-primary/40"
        >
          {post.profile?.avatar_url ? (
            <img src={post.profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to="/u/$username"
              params={{ username }}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-sm font-bold hover:underline"
            >
              {displayName}
            </Link>
            <span className="truncate text-xs text-muted-foreground">@{username}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="label-tape text-muted-foreground">{timeAgo(post.created_at)}</span>
            <VisibilityIcon visibility={post.visibility} />
          </div>
          <button
            onClick={goToPost}
            className="mt-0.5 block w-full truncate text-left text-base font-bold leading-tight hover:text-primary"
          >
            {post.title}
          </button>
        </div>
      </div>

      {/* Media */}
      <div
        className="relative mt-3 overflow-hidden rounded-lg bg-background"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        role="button"
        tabIndex={0}
      >
        {post.media_type === "video" ? (
          <div className="relative aspect-video w-full">
            <video
              ref={videoRef}
              src={post.media_url}
              poster={post.thumbnail_url ?? undefined}
              playsInline
              muted
              preload="metadata"
              className="h-full w-full object-cover"
            />
            {!playing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground">
                  <Play size={26} className="ml-1" />
                </span>
              </div>
            )}
            {playing && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  setMuted(v.muted);
                }}
                className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-foreground"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
          </div>
        ) : (
          <div className="px-4 py-5">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors",
                  playing && !muted
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/90 text-primary-foreground",
                )}
              >
                {playing && muted ? <VolumeX size={22} /> : <Play size={22} className="ml-0.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <Waveform
                  data={post.waveform_data}
                  progress={progress}
                  playing={playing && !muted}
                  height={48}
                  bars={56}
                />
                <div className="mt-1 flex items-center justify-between label-tape text-muted-foreground">
                  <span>{post.media_type.toUpperCase()}</span>
                  <span>{formatDuration(post.duration_seconds)}</span>
                </div>
              </div>
            </div>
            <audio ref={audioRef} src={post.media_url} preload="metadata" />
          </div>
        )}
      </div>

      {/* Description */}
      {post.description && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {post.description}
        </p>
      )}

      {/* Tags */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <InstrumentBadge tag={post.instrument_tag} />
        <span className="label-tape text-muted-foreground">{post.play_count} plays</span>
      </div>

      {/* Social actions */}
      <div className="mt-3 border-t border-border pt-2">
        <SocialActions postId={post.id} onCommentClick={goToPost} />
      </div>
    </article>
  );
}

function VisibilityIcon({ visibility }: { visibility: string }) {
  if (visibility === "public") return null;
  if (visibility === "private")
    return (
      <span className="label-tape inline-flex items-center gap-1 text-muted-foreground">
        <Lock size={11} /> private
      </span>
    );
  if (visibility === "followers")
    return (
      <span className="label-tape inline-flex items-center gap-1 text-muted-foreground">
        <Users size={11} /> followers
      </span>
    );
  return (
    <span className="label-tape inline-flex items-center gap-1 text-muted-foreground">
      <Lock size={11} /> {visibility}
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}
