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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);

  const computeProgress = (clientX: number): number => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const p = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, p));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    const p = computeProgress(e.clientX);
    setDragProgress(p);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek || !dragging) return;
    e.stopPropagation();
    const p = computeProgress(e.clientX);
    setDragProgress(p);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    e.stopPropagation();
    const p = computeProgress(e.clientX);
    onSeek(p);
    setDragging(false);
    setDragProgress(null);
    (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
  };

  const handlePointerCancel = () => {
    setDragging(false);
    setDragProgress(null);
  };

  const shownProgress = dragProgress ?? progress;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center gap-[2px] select-none touch-none",
        onSeek && "cursor-pointer",
        className,
      )}
      style={{ height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={(e) => e.stopPropagation()}
      role={onSeek ? "slider" : undefined}
      aria-label="Audio waveform"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={shownProgress}
    >
      {peaks.map((p, i) => {
        const filled = i / peaks.length <= shownProgress;
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-[1px] transition-colors pointer-events-none",
              filled ? "bg-primary" : "bg-foreground/25",
              playing && !dragging && "wave-bar-playing",
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
