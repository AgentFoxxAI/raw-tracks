import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/discover")({
  component: DiscoverPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

interface ProfileResult {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  collab_status: string;
}

function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      let q = supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,bio,follower_count,collab_status")
        .order("follower_count", { ascending: false })
        .limit(40);
      if (query.trim()) {
        const term = `%${query.trim()}%`;
        q = q.or(`username.ilike.${term},display_name.ilike.${term},bio.ilike.${term}`);
      }
      const { data } = await q;
      if (!active) return;
      setResults(((data ?? []) as ProfileResult[]).filter((p) => p.username));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [query]);

  return (
    <AppShell>
      <div className="mb-4">
        <p className="label-tape text-primary">Discover</p>
        <h1 className="text-2xl font-black">Find artists</h1>
      </div>

      <div className="relative mb-5">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, handle, or bio"
          className="w-full rounded-md border border-border bg-surface px-9 py-2.5 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No artists found.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {results.map((p) => {
            const dn = p.display_name ?? p.username ?? "—";
            const initials = dn.slice(0, 1).toUpperCase();
            return (
              <li key={p.id}>
                <Link
                  to="/u/$username"
                  params={{ username: p.username ?? "" }}
                  className="flex items-center gap-3 p-3 hover:bg-surface-elevated"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-black text-primary-foreground">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold">{dn}</span>
                      {p.collab_status === "open" && (
                        <span className="label-tape shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 text-emerald-300">
                          open
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      @{p.username} · {p.follower_count} followers
                    </p>
                    {p.bio && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-foreground/70">{p.bio}</p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
