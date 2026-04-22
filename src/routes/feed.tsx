import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { PostCard, type PostCardData } from "@/components/PostCard";
import { INSTRUMENT_TAGS } from "@/lib/instrument";
import { cn } from "@/lib/utils";

type Tab = "for-you" | "following";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

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

function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("for-you");

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    (async () => {
      let followingIds: string[] = [];
      if (tab === "following" || true) {
        const { data: f } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);
        followingIds = (f ?? []).map((r) => r.following_id);
      }

      let q = supabase
        .from("posts")
        .select(
          "id,user_id,title,description,media_type,media_url,thumbnail_url,duration_seconds,instrument_tag,visibility,waveform_data,play_count,created_at",
        )
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(80);
      if (filter) q = q.eq("instrument_tag", filter);
      if (tab === "following") {
        if (followingIds.length === 0) {
          if (!active) return;
          setPosts([]);
          setLoading(false);
          return;
        }
        q = q.in("user_id", followingIds);
      }
      const { data, error } = await q;
      if (!active) return;
      if (error || !data) {
        setPosts([]);
        setLoading(false);
        return;
      }
      const raw = data as unknown as RawPost[];

      // For "For you": rank — followed users first, then chronological
      const followSet = new Set(followingIds);
      const ranked =
        tab === "for-you"
          ? [...raw].sort((a, b) => {
              const aF = followSet.has(a.user_id) ? 1 : 0;
              const bF = followSet.has(b.user_id) ? 1 : 0;
              if (aF !== bF) return bF - aF;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })
          : raw;

      const userIds = Array.from(new Set(ranked.map((o) => o.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

      const merged: PostCardData[] = ranked.map((o) => ({
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
        profile: profMap.get(o.user_id) ?? null,
      }));
      setPosts(merged);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [filter, tab, user]);

  return (
    <AppShell>
      {/* Tabs */}
      <div className="-mx-4 mb-3 border-b border-border">
        <div className="mx-auto flex max-w-2xl">
          <TabBtn active={tab === "for-you"} onClick={() => setTab("for-you")}>
            For you
          </TabBtn>
          <TabBtn active={tab === "following"} onClick={() => setTab("following")}>
            Following
          </TabBtn>
        </div>
      </div>

      <div className="-mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          <FilterPill active={filter === null} onClick={() => setFilter(null)}>
            All
          </FilterPill>
          {INSTRUMENT_TAGS.map((t) => (
            <FilterPill key={t} active={filter === t} onClick={() => setFilter(t)}>
              {t}
            </FilterPill>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyFeed tab={tab} />
      ) : (
        <div className="space-y-3">
          {posts.map((o) => (
            <PostCard key={o.id} post={o} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function TabBtn({
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
        "relative flex-1 px-4 py-3 text-sm font-bold transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {active && (
        <span className="absolute inset-x-1/4 bottom-0 h-1 rounded-t-full bg-primary" />
      )}
    </button>
  );
}

function FilterPill({
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
        "label-tape shrink-0 rounded-full border px-3 py-1.5 transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyFeed({ tab }: { tab: Tab }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
      <p className="label-tape text-primary">{tab === "following" ? "Quiet feed" : "Quiet in here"}</p>
      <h3 className="mt-2 text-xl font-bold">
        {tab === "following" ? "Follow some artists." : "No posts yet."}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {tab === "following"
          ? "Once you follow people, their tracks will land here."
          : "Be the first to drop a take. The feed is built from raw uploads — no algorithm."}
      </p>
      <Link
        to={tab === "following" ? "/discover" : "/upload"}
        className="mt-5 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
      >
        {tab === "following" ? "Discover artists" : "Upload a post"}
      </Link>
    </div>
  );
}
