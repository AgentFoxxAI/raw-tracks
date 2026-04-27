import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface WaveformProps {
  data?: number[] | null;
  progress?: number; // 0..1
  playing?: boolean;
  height?: number;
  bars?: number;
  className?: string;
  onSeek?: (progress: number) => void;
}

/** A pseudo-random but stable waveform when no real data is available. */
function fallbackWaveform(bars: number, seed = 1): number[] {
  const out: number[] = [];
  let s = seed * 9301 + 49297;
  for (let i = 0; i < bars; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    // bias toward middle-amplitude bars with occasional peaks
    const v = 0.25 + r * 0.65 + Math.sin(i / 3) * 0.1;
    out.push(Math.min(1, Math.max(0.08, v)));
  }
  return out;
}

export function Waveform({
  data,
  progress = 0,
  playing = false,
  height = 56,
  bars = 64,
  className,
  onSeek,
}: WaveformProps) {
  const peaks = useMemo(() => {
    if (data && data.length > 0) {
      // Resample to desired bar count
      if (data.length === bars) return data;
      const out: number[] = [];
      const ratio = data.length / bars;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor(i * ratio);
        out.push(data[idx] ?? 0);
      }
      return out;
    }
    return fallbackWaveform(bars);
  }, [data, bars]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, p)));
  };

  return (
    <div
      className={cn(
        "flex items-center gap-[2px] select-none",
        onSeek && "cursor-pointer",
        className,
      )}
      style={{ height }}
      onClick={handleClick}
      role={onSeek ? "slider" : undefined}
      aria-label="Audio waveform"
    >
      {peaks.map((p, i) => {
        const filled = i / peaks.length <= progress;
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-[1px] transition-colors",
              filled ? "bg-primary" : "bg-foreground/25",
              playing && "wave-bar-playing",
            )}
            style={{
              height: `${Math.max(8, p * 100)}%`,
              animationDelay: playing ? `${(i % 12) * 60}ms` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
