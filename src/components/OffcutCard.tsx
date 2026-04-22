import { Link } from "@tanstack/react-router";
import { Play as PlayIcon } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import { InstrumentBadge, LicenseBadge } from "./InstrumentBadge";
import { supabase } from "@/integrations/supabase/client";

export interface OffcutCardData {
  id: string;
  title: string;
  description: string | null;
  audio_url: string;
  duration_seconds: number | null;
  instrument_tag: string;
  license_type: string;
  waveform_data: number[] | null;
  play_count: number;
  created_at: string;
  profile?: { username: string | null; avatar_url: string | null } | null;
}

export function OffcutCard({ offcut }: { offcut: OffcutCardData }) {
  const onFirstPlay = () => {
    void supabase.rpc("increment_play_count", { offcut_id_input: offcut.id });
  };

  const initials = (offcut.profile?.username ?? "?")
    .slice(0, 1)
    .toUpperCase();

  return (
    <article className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-sm font-bold text-foreground">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              @{offcut.profile?.username ?? "anon"}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="label-tape text-muted-foreground">
              {timeAgo(offcut.created_at)}
            </span>
          </div>
          <Link
            to="/offcut/$id"
            params={{ id: offcut.id }}
            className="mt-0.5 block truncate text-base font-bold leading-tight hover:text-primary"
          >
            {offcut.title}
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <AudioPlayer
          url={offcut.audio_url}
          waveformData={offcut.waveform_data}
          duration={offcut.duration_seconds}
          onFirstPlay={onFirstPlay}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <InstrumentBadge tag={offcut.instrument_tag} />
        <LicenseBadge license={offcut.license_type} />
        <span className="label-tape ml-auto inline-flex items-center gap-1 text-muted-foreground">
          <PlayIcon size={11} /> {offcut.play_count}
        </span>
      </div>
    </article>
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
