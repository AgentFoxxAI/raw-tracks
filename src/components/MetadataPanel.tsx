import { useState } from "react";
import { ChevronDown, ChevronUp, Activity, Music2, Clock, Gauge, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AudioMetadata } from "@/lib/audio-analysis";
import { formatDuration } from "@/lib/instrument";

interface Props {
  metadata: AudioMetadata;
  /** Show as inline compact strip (for feed cards) vs full block (post detail / upload) */
  variant?: "compact" | "full";
  /** Mark as auto-detected so we surface a subtle "auto" tag */
  autoDetected?: boolean;
  className?: string;
}

const SECTION_COLORS: Record<string, string> = {
  intro: "bg-muted-foreground/40",
  verse: "bg-primary/60",
  build: "bg-amber-500/70",
  drop: "bg-rose-500/80",
  break: "bg-muted-foreground/30",
  outro: "bg-muted-foreground/40",
};

export function MetadataPanel({ metadata, variant = "full", autoDetected = true, className }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Compact: a single horizontal chip row
  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <Chip icon={<Gauge size={11} />} label={`${metadata.bpm} BPM`} />
        <Chip icon={<Clock size={11} />} label={metadata.time_signature} />
        <Chip icon={<Music2 size={11} />} label={metadata.key} />
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-background/60", className)}>
      {/* Basic row — always visible */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip icon={<Gauge size={11} />} label={`${metadata.bpm} BPM`} primary />
          <Chip icon={<Clock size={11} />} label={metadata.time_signature} />
          <Chip icon={<Music2 size={11} />} label={metadata.key} />
          {autoDetected && (
            <span className="label-tape inline-flex items-center gap-1 text-muted-foreground">
              <Sparkles size={10} className="text-primary" /> auto
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="label-tape inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground hover:text-foreground"
          aria-expanded={expanded}
          aria-label={expanded ? "Hide advanced metadata" : "Show advanced metadata"}
        >
          {expanded ? "less" : "advanced"}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Advanced — expandable */}
      {expanded && (
        <div className="space-y-3 border-t border-border px-3 pb-3 pt-3">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Tempo" value={`${metadata.bpm}`} sub={`±${Math.round((1 - metadata.bpm_confidence) * 8)} BPM`} />
            <Stat label="Meter" value={metadata.time_signature} sub="time signature" />
            <Stat label="Key" value={metadata.key.split(" ")[0]} sub={metadata.mode} />
            <Stat
              label="Energy"
              value={`${Math.round(metadata.energy * 100)}%`}
              sub={`${metadata.loudness_db} dBFS`}
            />
          </div>

          {/* Energy bar */}
          <div>
            <div className="flex items-center justify-between">
              <span className="label-tape inline-flex items-center gap-1 text-muted-foreground">
                <Activity size={10} /> Energy
              </span>
              <span className="label-tape text-muted-foreground">{Math.round(metadata.energy * 100)} / 100</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full bg-gradient-to-r from-primary to-rose-500"
                style={{ width: `${Math.round(metadata.energy * 100)}%` }}
              />
            </div>
          </div>

          {/* Section map */}
          {metadata.sections.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <span className="label-tape text-muted-foreground">Song structure</span>
                <span className="label-tape text-muted-foreground">{metadata.sections.length} sections</span>
              </div>
              <div className="mt-1 flex h-6 w-full overflow-hidden rounded-md border border-border">
                {metadata.sections.map((s, i) => {
                  const total = metadata.sections[metadata.sections.length - 1].end;
                  const pct = ((s.end - s.start) / total) * 100;
                  return (
                    <div
                      key={i}
                      className={cn("relative flex items-center justify-center text-[9px] font-bold uppercase text-foreground/90", SECTION_COLORS[s.label])}
                      style={{ width: `${pct}%` }}
                      title={`${s.label} · ${formatDuration(s.start)}–${formatDuration(s.end)}`}
                    >
                      {pct > 8 ? s.label : ""}
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground sm:grid-cols-3">
                {metadata.sections.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-sm", SECTION_COLORS[s.label])} />
                    <span className="font-semibold capitalize text-foreground/80">{s.label}</span>
                    <span>· {formatDuration(s.start)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ icon, label, primary }: { icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        primary
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-surface text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <p className="label-tape text-muted-foreground">{label}</p>
      <p className="text-base font-bold leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
