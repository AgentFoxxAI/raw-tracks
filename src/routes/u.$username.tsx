import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Sparkles, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { PostCard, type PostCardData } from "@/components/PostCard";

export const Route = createFileRoute("/u/$username")({
  component: UserProfilePage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

interface PublicProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  instruments: string[];
  influences: string | null;
  location: string | null;
  collab_status: string;
  links: Array<{ label: string; url: string }>;
  follower_count: number;
  following_count: number;
}

function UserProfilePage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [target, setTarget] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (!active) return;
      if (!prof) {
        setTarget(null);
        setLoading(false);
        return;
      }
      const tp: PublicProfile = {
        id: prof.id,
        username: prof.username,
        display_name: (prof as { display_name?: string | null }).display_name ?? prof.username,
        avatar_url: prof.avatar_url,
        bio: (prof as { bio?: string | null }).bio ?? null,
        instruments: ((prof as { instruments?: string[] }).instruments ?? []) as string[],
        influences: (prof as { influences?: string | null }).influences ?? null,
        location: (prof as { location?: string | null }).location ?? null,
        collab_status: (prof as { collab_status?: string }).collab_status ?? "closed",
        links: (((prof as { links?: unknown }).links ?? []) as PublicProfile["links"]),
        follower_count: (prof as { follower_count?: number }).follower_count ?? 0,
        following_count: (prof as { following_count?: number }).following_count ?? 0,
      };
      setTarget(tp);

      // Posts
      const { data: ps } = await supabase
        .from("posts")
        .select(
          "id,user_id,title,description,media_type,media_url,thumbnail_url,duration_seconds,instrument_tag,visibility,waveform_data,play_count,created_at",
        )
        .eq("user_id", tp.id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false });
      if (!active) return;
      setPosts(
        (ps ?? []).map((o) => ({
          id: o.id,
          user_id: o.user_id,
          title: o.title,
          description: o.description,
          media_type: (o.media_type as "audio" | "video") ?? "audio",
          media_url: o.media_url,
          thumbnail_url: o.thumbnail_url,
          duration_seconds: o.duration_seconds,
          instrument_tag: o.instrument_tag,
          visibility: o.visibility,
          waveform_data: (o.waveform_data as number[] | null) ?? null,
          play_count: o.play_count,
          created_at: o.created_at,
          profile: {
            id: tp.id,
            username: tp.username,
            display_name: tp.display_name,
            avatar_url: tp.avatar_url,
          },
        })),
      );

      // Follow state
      if (user && user.id !== tp.id) {
        const { data: f } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", tp.id)
          .maybeSingle();
        if (!active) return;
        setFollowing(!!f);
      }

      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username, user]);

  const toggleFollow = async () => {
    if (!user || !target) return;
    setFollowBusy(true);
    if (following) {
      setFollowing(false);
      setTarget((t) => (t ? { ...t, follower_count: Math.max(0, t.follower_count - 1) } : t));
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", target.id);
    } else {
      setFollowing(true);
      setTarget((t) => (t ? { ...t, follower_count: t.follower_count + 1 } : t));
      await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: target.id });
    }
    setFollowBusy(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </AppShell>
    );
  }

  if (!target) {
    return (
      <AppShell>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-bold">User not found.</p>
          <Link to="/feed" className="mt-3 inline-block text-primary">
            Back to feed
          </Link>
        </div>
      </AppShell>
    );
  }

  const isMe = user?.id === target.id;
  const displayName = target.display_name ?? target.username ?? "—";
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <AppShell>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-3xl font-black text-primary-foreground">
            {target.avatar_url ? (
              <img src={target.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black leading-tight">{displayName}</h1>
            <p className="truncate text-sm text-muted-foreground">@{target.username ?? "—"}</p>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span>
                <span className="font-bold">{target.following_count}</span>{" "}
                <span className="text-muted-foreground">Following</span>
              </span>
              <span>
                <span className="font-bold">{target.follower_count}</span>{" "}
                <span className="text-muted-foreground">Followers</span>
              </span>
            </div>
          </div>
          {isMe ? (
            <button
              onClick={() => navigate({ to: "/profile/edit" })}
              className="rounded-full border border-border bg-surface-elevated px-4 py-1.5 text-sm font-bold text-foreground hover:border-primary/50"
            >
              Edit profile
            </button>
          ) : (
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={
                "rounded-full px-5 py-1.5 text-sm font-bold transition-colors " +
                (following
                  ? "border border-border bg-background text-foreground hover:border-destructive/50 hover:text-destructive"
                  : "bg-primary text-primary-foreground hover:opacity-90")
              }
            >
              {following ? "Following" : "Follow"}
            </button>
          )}
        </div>

        {target.bio && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {target.bio}
          </p>
        )}

        {(target.location || target.influences || target.collab_status === "open") && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {target.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {target.location}
              </span>
            )}
            {target.influences && (
              <span className="inline-flex items-center gap-1">
                <Sparkles size={12} /> {target.influences}
              </span>
            )}
            {target.collab_status === "open" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                Open to collaborate
              </span>
            )}
          </div>
        )}

        {target.instruments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {target.instruments.map((i) => (
              <span
                key={i}
                className="label-tape rounded-full border border-border bg-background px-2 py-0.5 text-foreground/80"
              >
                {i}
              </span>
            ))}
          </div>
        )}

        {target.links.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {target.links.map((l, idx) => (
              <a
                key={idx}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <LinkIcon size={12} />
                {l.label || l.url}
              </a>
            ))}
          </div>
        )}
      </div>

      <h2 className="mt-6 px-1 text-sm font-bold text-muted-foreground">Posts</h2>
      <div className="mt-2 space-y-3">
        {posts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            No public posts yet.
          </p>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </AppShell>
  );
}
