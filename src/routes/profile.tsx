import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { OffcutCard, type OffcutCardData } from "@/components/OffcutCard";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [tab, setTab] = useState<"mine" | "stacks">("mine");
  const [mine, setMine] = useState<OffcutCardData[]>([]);
  const [stacked, setStacked] = useState<OffcutCardData[]>([]);
  const [stats, setStats] = useState({ totalOffcuts: 0, totalPlays: 0, avgRating: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: own } = await supabase
        .from("offcuts")
        .select("id,title,description,audio_url,duration_seconds,instrument_tag,license_type,waveform_data,play_count,created_at,user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const profilePart = { username: profile?.username ?? null, avatar_url: profile?.avatar_url ?? null };
      const ownData = (own ?? []).map((o) => ({
        ...o,
        waveform_data: (o.waveform_data as number[] | null) ?? null,
        profile: profilePart,
      }));
      setMine(ownData);

      const totalPlays = ownData.reduce((acc, o) => acc + (o.play_count ?? 0), 0);
      const { data: ratings } = await supabase
        .from("interactions")
        .select("rating, offcut_id")
        .eq("type", "rating")
        .in("offcut_id", ownData.length ? ownData.map((o) => o.id) : ["00000000-0000-0000-0000-000000000000"]);
      const valid = (ratings ?? []).filter((r) => typeof r.rating === "number");
      const avg = valid.length > 0
        ? valid.reduce((a, r) => a + (r.rating as number), 0) / valid.length
        : 0;
      setStats({ totalOffcuts: ownData.length, totalPlays, avgRating: avg });

      // My stacks: offcuts I've stacked on others (children I created)
      const { data: stackRows } = await supabase
        .from("stacks")
        .select("child_offcut_id")
        .eq("created_by_user_id", user.id);
      const childIds = (stackRows ?? []).map((s) => s.child_offcut_id);
      if (childIds.length) {
        const { data: kids } = await supabase
          .from("offcuts")
          .select("id,title,description,audio_url,duration_seconds,instrument_tag,license_type,waveform_data,play_count,created_at,user_id")
          .in("id", childIds);
        setStacked(
          (kids ?? []).map((k) => ({
            ...k,
            waveform_data: (k.waveform_data as number[] | null) ?? null,
            profile: profilePart,
          })),
        );
      }
    })();
  }, [user, profile]);

  const list = tab === "mine" ? mine : stacked;

  return (
    <AppShell>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-black text-primary-foreground">
            {(profile?.username ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black">@{profile?.username ?? "..."}</h1>
            <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
            <span
              className={
                "label-tape mt-1.5 inline-block rounded-full border px-2 py-0.5 " +
                (profile?.tier === "paid"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground")
              }
            >
              {profile?.tier === "paid" ? "Pro" : "Free tier"}
            </span>
          </div>
          <button
            onClick={async () => {
              await signOut();
              void navigate({ to: "/auth" });
            }}
            className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Offcuts" value={stats.totalOffcuts} />
          <Stat label="Plays" value={stats.totalPlays} />
          <Stat label="Avg ★" value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "–"} />
        </div>
      </div>

      <div className="mt-6 flex gap-2 rounded-md border border-border bg-surface p-1">
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          My Offcuts
        </TabButton>
        <TabButton active={tab === "stacks"} onClick={() => setTab("stacks")}>
          My Stacks
        </TabButton>
      </div>

      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            Nothing here yet.
          </p>
        ) : (
          list.map((o) => <OffcutCard key={o.id} offcut={o} />)
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-center">
      <p className="text-xl font-black text-primary">{value}</p>
      <p className="label-tape text-muted-foreground">{label}</p>
    </div>
  );
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
      className={
        "flex-1 rounded-md py-2 text-sm font-semibold transition-colors " +
        (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
