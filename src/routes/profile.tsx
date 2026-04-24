import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Pencil, MapPin, Sparkles, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { AvatarUploader } from "@/components/AvatarUploader";
import { PostCard, type PostCardData } from "@/components/PostCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

type Tab = "posts" | "reposts" | "likes" | "saves";

function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    (async () => {
      const profilePart = {
        id: user.id,
        username: profile?.username ?? null,
        display_name: profile?.display_name ?? profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
      };

      let postIds: string[] | null = null;

      if (tab === "posts") {
        const { data } = await supabase
          .from("posts")
          .select(
            "id,user_id,title,description,media_type,media_url,thumbnail_url,duration_seconds,instrument_tag,visibility,waveform_data,play_count,created_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (!active) return;
        setPosts(toCards(data, profilePart));
        setLoading(false);
        return;
      }

      if (tab === "likes") {
        const { data: ls } = await supabase
          .from("likes")
          .select("post_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        postIds = (ls ?? []).map((l) => l.post_id);
      } else if (tab === "reposts") {
        const { data: rs } = await supabase
          .from("reposts")
          .select("post_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        postIds = (rs ?? []).map((r) => r.post_id);
      } else if (tab === "saves") {
        const { data: ss } = await supabase
          .from("saves")
          .select("post_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        postIds = (ss ?? []).map((s) => s.post_id);
      }

      if (!postIds || postIds.length === 0) {
        if (!active) return;
        setPosts([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("posts")
        .select(
          "id,user_id,title,description,media_type,media_url,thumbnail_url,duration_seconds,instrument_tag,visibility,waveform_data,play_count,created_at",
        )
        .in("id", postIds);
      // Hydrate profiles for the actual authors of each post
      const userIds = Array.from(new Set((data ?? []).map((d) => d.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      const pm = new Map((profs ?? []).map((p) => [p.id, p]));
      if (!active) return;
      const cards: PostCardData[] = (data ?? []).map((o) => ({
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
        profile: pm.get(o.user_id) ?? null,
      }));
      // Preserve interaction order
      const orderMap = new Map(postIds.map((id, idx) => [id, idx]));
      cards.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
      setPosts(cards);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user, profile, tab]);

  if (!profile) {
    return (
      <AppShell>
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </AppShell>
    );
  }

  const displayName = profile.display_name ?? profile.username ?? "—";
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <AppShell>
      {/* Identity card */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start gap-4">
          <AvatarUploader
            avatarUrl={profile.avatar_url}
            fallback={initials}
            size={80}
            variant="ring"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black leading-tight">{displayName}</h1>
            <p className="truncate text-sm text-muted-foreground">@{profile.username ?? "—"}</p>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <Link to="/profile" className="hover:text-primary">
                <span className="font-bold">{profile.following_count}</span>{" "}
                <span className="text-muted-foreground">Following</span>
              </Link>
              <Link to="/profile" className="hover:text-primary">
                <span className="font-bold">{profile.follower_count}</span>{" "}
                <span className="text-muted-foreground">Followers</span>
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              to="/profile/edit"
              className="rounded-md border border-border bg-surface-elevated p-2 text-foreground hover:border-primary/50"
              aria-label="Edit profile"
            >
              <Pencil size={16} />
            </Link>
            <button
              onClick={async () => {
                await signOut();
                void navigate({ to: "/auth" });
              }}
              className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Bio */}
        {profile.bio ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {profile.bio}
          </p>
        ) : (
          <Link
            to="/profile/edit"
            className="mt-4 block rounded-lg border border-dashed border-border bg-background/40 p-3 text-center text-sm text-muted-foreground hover:border-primary/50 hover:text-primary"
          >
            + Add a bio
          </Link>
        )}

        {/* Meta row */}
        {(profile.location || profile.influences || profile.collab_status === "open") && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {profile.location}
              </span>
            )}
            {profile.influences && (
              <span className="inline-flex items-center gap-1">
                <Sparkles size={12} /> {profile.influences}
              </span>
            )}
            {profile.collab_status === "open" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                Open to collaborate
              </span>
            )}
          </div>
        )}

        {/* Instruments */}
        {profile.instruments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.instruments.map((i) => (
              <span
                key={i}
                className="label-tape rounded-full border border-border bg-background px-2 py-0.5 text-foreground/80"
              >
                {i}
              </span>
            ))}
          </div>
        )}

        {/* Links */}
        {profile.links.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {profile.links.map((l, idx) => (
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

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-md border border-border bg-surface p-1">
        {(["posts", "reposts", "likes", "saves"] as const).map((t) => (
          <TabButton key={t} active={tab === t} onClick={() => setTab(t)}>
            {t === "posts"
              ? "Posts"
              : t === "reposts"
                ? "Reposts"
                : t === "likes"
                  ? "Likes"
                  : "Saves"}
          </TabButton>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="h-44 animate-pulse rounded-xl bg-surface" />
        ) : posts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            Nothing here yet.
          </p>
        ) : (
          posts.map((o) => <PostCard key={o.id} post={o} />)
        )}
      </div>
    </AppShell>
  );
}

interface RawPost {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  instrument_tag: string;
  visibility: string;
  waveform_data: unknown;
  play_count: number;
  created_at: string;
}

function toCards(
  data: RawPost[] | null,
  prof: { id?: string; username: string | null; display_name?: string | null; avatar_url: string | null },
): PostCardData[] {
  return (data ?? []).map((o) => ({
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
    profile: prof,
  }));
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md py-2 text-sm font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
