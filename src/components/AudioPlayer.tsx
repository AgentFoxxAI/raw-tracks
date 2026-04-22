import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Waveform } from "./Waveform";
import { formatDuration } from "@/lib/instrument";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  url: string;
  waveformData?: number[] | null;
  duration?: number | null;
  size?: "sm" | "md" | "lg";
  onFirstPlay?: () => void;
  className?: string;
}

export function AudioPlayer({
  url,
  waveformData,
  duration,
  size = "md",
  onFirstPlay,
  className,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const firedFirstPlayRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrent(audio.currentTime);
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
      if (!firedFirstPlayRef.current) {
        firedFirstPlayRef.current = true;
        onFirstPlay?.();
      }
    }
  };

  const seek = (p: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = p * audio.duration;
    setProgress(p);
  };

  const heights = { sm: 36, md: 56, lg: 96 } as const;
  const btnSize = { sm: "h-9 w-9", md: "h-11 w-11", lg: "h-14 w-14" } as const;
  const iconSize = { sm: 16, md: 20, lg: 24 } as const;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        onClick={toggle}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95",
          btnSize[size],
        )}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={iconSize[size]} /> : <Play size={iconSize[size]} className="ml-0.5" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Waveform
          data={waveformData}
          progress={progress}
          playing={playing}
          height={heights[size]}
          bars={size === "lg" ? 96 : 56}
          onSeek={seek}
        />
        <div className="flex justify-between label-tape text-muted-foreground">
          <span>{formatDuration(current)}</span>
          <span>{formatDuration(duration ?? audioRef.current?.duration ?? 0)}</span>
        </div>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
}
