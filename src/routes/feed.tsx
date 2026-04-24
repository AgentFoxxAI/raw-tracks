import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { PostCard, type PostCardData } from "@/components/PostCard";
import { MockFeedCard } from "@/components/MockFeedCard";
import { INSTRUMENT_TAGS } from "@/lib/instrument";
import { MOCK_FEED_POSTS, type MockFeedPost } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Tab = "for-you" | "following";
type FeedItem =
  | { kind: "real"; post: PostCardData; createdAt: number }
  | { kind: "mock"; post: MockFeedPost; createdAt: number };

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

const PULL_TRIGGER = 70; // px to trigger refresh
const PULL_MAX = 110;

function FeedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("for-you");
  const [refreshKey, setRefreshKey] = useState(0);

  // Pull-to-refresh state
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pullStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data: f } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const followingIds: string[] = (f ?? []).map((r) => r.following_id);

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
          // Following feed gets mocks too — they ARE the suggestion engine in demo
          const mockOnly: FeedItem[] = filteredMocks(filter).map((m) => ({
            kind: "mock",
            post: m,
            createdAt: new Date(m.created_at).getTime(),
          }));
          setItems(mockOnly);
          setLoading(false);
          return;
        }
        q = q.in("user_id", followingIds);
      }
      const { data, error } = await q;
      if (!active) return;

      const rawPosts: RawPost[] = error || !data ? [] : (data as unknown as RawPost[]);

      const userIds = Array.from(new Set(rawPosts.map((o) => o.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

      const followSet = new Set(followingIds);

      const realItems: FeedItem[] = rawPosts.map((o) => ({
        kind: "real" as const,
        post: {
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
        },
        createdAt: new Date(o.created_at).getTime(),
      }));

      const mockItems: FeedItem[] = filteredMocks(filter).map((m) => ({
        kind: "mock" as const,
        post: m,
        createdAt: new Date(m.created_at).getTime(),
      }));

      // Merge: real first by recency-with-follow boost, then weave mocks in
      let merged: FeedItem[];
      if (tab === "for-you") {
        // Boost real followed users to top, then chronological merge with mocks
        const sortedReal = [...realItems].sort((a, b) => {
          if (a.kind !== "real" || b.kind !== "real") return 0;
          const aF = followSet.has(a.post.user_id) ? 1 : 0;
          const bF = followSet.has(b.post.user_id) ? 1 : 0;
          if (aF !== bF) return bF - aF;
          return b.createdAt - a.createdAt;
        });
        merged = interleave(sortedReal, mockItems);
      } else {
        // Following: real followed posts + mock posts as "people you might follow"
        merged = [...realItems, ...mockItems].sort((a, b) => b.createdAt - a.createdAt);
      }

      setItems(merged);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [filter, tab, user, refreshKey]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    pullStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY.current === null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    // Apply resistance
    const resisted = Math.min(PULL_MAX, delta * 0.5);
    setPullDistance(resisted);
  };
  const handleTouchEnd = () => {
    if (pullDistance >= PULL_TRIGGER) {
      doRefresh();
    }
    pullStartY.current = null;
    setPullDistance(0);
  };

  const doRefresh = async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    // Allow refresh effect a beat to feel real
    setTimeout(() => setRefreshing(false), 700);
  };

  const triggered = pullDistance >= PULL_TRIGGER;

  return (
    <AppShell>
      <div
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="pointer-events-none -mt-2 flex items-center justify-center overflow-hidden text-muted-foreground transition-[height] duration-150"
          style={{ height: `${refreshing ? 36 : pullDistance}px` }}
        >
          {refreshing ? (
            <Loader2 size={18} className="animate-spin text-primary" />
          ) : pullDistance > 0 ? (
            <ArrowDown
              size={18}
              className={cn("transition-transform", triggered && "rotate-180 text-primary")}
            />
          ) : null}
        </div>

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

        {/* Desktop refresh button (no touch) */}
        <div className="mb-3 flex justify-end md:flex">
          <button
            onClick={doRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <ArrowDown size={12} />}
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyFeed tab={tab} />
        ) : (
          <div className="space-y-3">
            {items.map((it) =>
              it.kind === "real" ? (
                <PostCard key={it.post.id} post={it.post} />
              ) : (
                <MockFeedCard key={it.post.id} post={it.post} />
              ),
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/** Weave mocks into real items so the feed feels populated even before the user follows anyone. */
function interleave(real: FeedItem[], mocks: FeedItem[]): FeedItem[] {
  if (real.length === 0) return mocks;
  if (mocks.length === 0) return real;
  const out: FeedItem[] = [];
  const insertEvery = Math.max(2, Math.ceil(real.length / mocks.length));
  let mIdx = 0;
  for (let i = 0; i < real.length; i++) {
    out.push(real[i]);
    if ((i + 1) % insertEvery === 0 && mIdx < mocks.length) {
      out.push(mocks[mIdx++]);
    }
  }
  while (mIdx < mocks.length) out.push(mocks[mIdx++]);
  return out;
}

function filteredMocks(filter: string | null): MockFeedPost[] {
  if (!filter) return MOCK_FEED_POSTS;
  return MOCK_FEED_POSTS.filter((m) => m.instrument_tag === filter);
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
