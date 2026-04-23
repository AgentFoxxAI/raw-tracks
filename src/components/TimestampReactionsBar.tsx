import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MockTimestampReaction } from "@/lib/mock-data";

interface Props {
  reactions: MockTimestampReaction[];
  duration: number; // seconds, > 0
  currentSeconds: number;
  /** Live-flying reactions that should briefly pop above the bar as playback crosses them. */
  className?: string;
}

/**
 * SoundCloud-style reactions strip.
 * Renders an emoji at its timestamp position. As playback approaches, the
 * emoji animates up + fades. Hover/tap shows the user note.
 */
export function TimestampReactionsBar({ reactions, duration, currentSeconds, className }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  if (duration <= 0) return null;

  return (
    <div className={cn("relative h-7 w-full", className)}>
      {reactions.map((r) => {
        const left = `${Math.min(100, Math.max(0, (r.timestamp_seconds / duration) * 100))}%`;
        const distance = Math.abs(currentSeconds - r.timestamp_seconds);
        const live = distance < 0.6; // currently being played
        const passed = currentSeconds >= r.timestamp_seconds;
        return (
          <div
            key={r.id}
            className="absolute -translate-x-1/2 transition-all"
            style={{
              left,
              bottom: live ? "16px" : "0px",
              opacity: live ? 1 : passed ? 0.55 : 0.85,
            }}
            onMouseEnter={() => setHovered(r.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <button
              type="button"
              className={cn(
                "select-none text-base leading-none transition-transform",
                live && "scale-150",
              )}
              aria-label={`${r.emoji} from @${r.username}`}
            >
              {r.emoji}
            </button>
            {(hovered === r.id || live) && r.note && (
              <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground/90 shadow-md">
                <span className="font-bold text-primary">@{r.username}</span> {r.note}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
