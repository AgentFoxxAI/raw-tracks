import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { OffcutCard, type OffcutCardData } from "@/components/OffcutCard";
import { INSTRUMENT_TAGS } from "@/lib/instrument";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

function FeedPage() {
  const [offcuts, setOffcuts] = useState<OffcutCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      let query = supabase
        .from("offcuts")
        .select("id,title,description,audio_url,duration_seconds,instrument_tag,license_type,waveform_data,play_count,created_at,user_id")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(50);
      if (filter) query = query.eq("instrument_tag", filter);
      const { data, error } = await query;
      if (!active) return;
      if (error || !data) {
        setOffcuts([]);
        setLoading(false);
        return;
      }
      // Hydrate profiles in a separate query
      const userIds = Array.from(new Set(data.map((o) => o.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", userIds);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      const merged: OffcutCardData[] = data.map((o) => ({
        ...o,
        waveform_data: (o.waveform_data as number[] | null) ?? null,
        profile: profMap.get(o.user_id) ?? null,
      }));
      setOffcuts(merged);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [filter]);

  return (
    <AppShell>
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
            <div key={i} className="h-44 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : offcuts.length === 0 ? (
        <EmptyFeed />
      ) : (
        <div className="space-y-3">
          {offcuts.map((o) => (
            <OffcutCard key={o.id} offcut={o} />
          ))}
        </div>
      )}
    </AppShell>
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

function EmptyFeed() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
      <p className="label-tape text-primary">Quiet in here</p>
      <h3 className="mt-2 text-xl font-bold">No offcuts yet.</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Be the first to drop a take. The feed is built from raw uploads — no algorithm.
      </p>
      <Link
        to="/upload"
        className="mt-5 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
      >
        Upload an offcut
      </Link>
    </div>
  );
}
