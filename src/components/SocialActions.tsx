import { useEffect, useState } from "react";
import { Heart, MessageCircle, Repeat2, Bookmark, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface Counts {
  likes: number;
  comments: number;
  reposts: number;
}

interface Props {
  postId: string;
  initialCounts?: Partial<Counts>;
  onCommentClick?: () => void;
  className?: string;
}

export function SocialActions({ postId, initialCounts, onCommentClick, className }: Props) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({
    likes: initialCounts?.likes ?? 0,
    comments: initialCounts?.comments ?? 0,
    reposts: initialCounts?.reposts ?? 0,
  });
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [likeRes, repostRes, saveRes, likeCount, commentCount, repostCount] =
        await Promise.all([
          user
            ? supabase.from("likes").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle()
            : Promise.resolve({ data: null }),
          user
            ? supabase.from("reposts").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle()
            : Promise.resolve({ data: null }),
          user
            ? supabase.from("saves").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", postId),
          supabase.from("comments").select("id", { count: "exact", head: true }).eq("post_id", postId),
          supabase.from("reposts").select("id", { count: "exact", head: true }).eq("post_id", postId),
        ]);
      if (cancelled) return;
      setLiked(!!likeRes.data);
      setReposted(!!repostRes.data);
      setSaved(!!saveRes.data);
      setCounts({
        likes: likeCount.count ?? 0,
        comments: commentCount.count ?? 0,
        reposts: repostCount.count ?? 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, user]);

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setCounts((c) => ({ ...c, likes: Math.max(0, c.likes - 1) }));
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      setLiked(true);
      setCounts((c) => ({ ...c, likes: c.likes + 1 }));
      await supabase.from("likes").insert({ post_id: postId, user_id: user.id });
    }
  };

  const toggleRepost = async () => {
    if (!user) return;
    if (reposted) {
      setReposted(false);
      setCounts((c) => ({ ...c, reposts: Math.max(0, c.reposts - 1) }));
      await supabase.from("reposts").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      setReposted(true);
      setCounts((c) => ({ ...c, reposts: c.reposts + 1 }));
      await supabase.from("reposts").insert({ post_id: postId, user_id: user.id });
    }
  };

  const toggleSave = async () => {
    if (!user) return;
    if (saved) {
      setSaved(false);
      await supabase.from("saves").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      setSaved(true);
      await supabase.from("saves").insert({ post_id: postId, user_id: user.id });
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className={cn("flex items-center justify-between text-muted-foreground", className)}>
      <ActionBtn
        onClick={(e) => {
          e.stopPropagation();
          onCommentClick?.();
        }}
        icon={<MessageCircle size={18} />}
        count={counts.comments}
        label="Reply"
      />
      <ActionBtn
        onClick={(e) => {
          e.stopPropagation();
          void toggleRepost();
        }}
        icon={<Repeat2 size={18} />}
        count={counts.reposts}
        active={reposted}
        activeColor="text-emerald-400"
        label="Repost"
      />
      <ActionBtn
        onClick={(e) => {
          e.stopPropagation();
          void toggleLike();
        }}
        icon={<Heart size={18} fill={liked ? "currentColor" : "none"} />}
        count={counts.likes}
        active={liked}
        activeColor="text-primary"
        label="Like"
      />
      <ActionBtn
        onClick={(e) => {
          e.stopPropagation();
          void toggleSave();
        }}
        icon={<Bookmark size={18} fill={saved ? "currentColor" : "none"} />}
        active={saved}
        activeColor="text-primary"
        label="Save"
      />
      <ActionBtn
        onClick={(e) => {
          e.stopPropagation();
          void handleShare();
        }}
        icon={<Share2 size={18} />}
        label="Share"
      />
    </div>
  );
}

function ActionBtn({
  icon,
  count,
  active,
  activeColor = "text-primary",
  onClick,
  label,
}: {
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
  activeColor?: string;
  onClick: (e: React.MouseEvent) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "group flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors hover:text-foreground",
        active && activeColor,
      )}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover:bg-surface-elevated">
        {icon}
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="tabular-nums">{formatCount(count)}</span>
      )}
    </button>
  );
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
