import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  bass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  guitar: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  vocals: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  drums: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  hihats: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  keys: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  synth: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  other: "bg-foreground/10 text-foreground/70 border-foreground/20",
};

export function InstrumentBadge({ tag, className }: { tag: string; className?: string }) {
  return (
    <span
      className={cn(
        "label-tape inline-flex items-center rounded-full border px-2 py-0.5",
        COLORS[tag] ?? COLORS.other,
        className,
      )}
    >
      {tag}
    </span>
  );
}

export function LicenseBadge({ license, className }: { license: string; className?: string }) {
  const map: Record<string, string> = {
    collaborate: "Collab OK",
    free_to_use: "Free to use",
    private: "Private",
  };
  return (
    <span
      className={cn(
        "label-tape inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary",
        className,
      )}
    >
      {map[license] ?? license}
    </span>
  );
}
