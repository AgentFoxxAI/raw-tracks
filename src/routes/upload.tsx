import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload as UploadIcon, X, Music, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { TermsModal } from "@/components/TermsModal";
import { Waveform } from "@/components/Waveform";
import {
  INSTRUMENT_TAGS,
  type InstrumentTag,
  fileToAudioBuffer,
  formatDuration,
  generateWaveformData,
  suggestInstrumentFromBuffer,
} from "@/lib/instrument";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

const ACCEPTED = ".m4a,.mp3,.wav,.mp4,.mov,.webm,audio/*,video/*";
const MAX_VIDEO_SECONDS = 60;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

type Visibility = "public" | "followers" | "private";

function UploadPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const [showTerms, setShowTerms] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"audio" | "video">("audio");
  const [waveform, setWaveform] = useState<number[] | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instrument, setInstrument] = useState<InstrumentTag>("other");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [commentsEnabled, setCommentsEnabled] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !profile.terms_accepted) setShowTerms(true);
  }, [profile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = useCallback(async (f: File) => {
    setErr(null);
    const isVideo = f.type.startsWith("video/");

    if (isVideo) {
      if (f.size > MAX_VIDEO_BYTES) {
        setErr("Video is over 50MB. Try a shorter clip.");
        return;
      }
    }

    setFile(f);
    setMediaType(isVideo ? "video" : "audio");
    setAnalyzing(true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    try {
      // Decode audio (works for both audio + video files)
      const buffer = await fileToAudioBuffer(f);
      setDuration(buffer.duration);
      setWaveform(generateWaveformData(buffer));
      setInstrument(suggestInstrumentFromBuffer(buffer));

      if (isVideo && buffer.duration > MAX_VIDEO_SECONDS) {
        setErr(`Video is ${Math.round(buffer.duration)}s — keep it under ${MAX_VIDEO_SECONDS}s.`);
        setFile(null);
        URL.revokeObjectURL(url);
        setPreviewUrl(null);
        setAnalyzing(false);
        return;
      }

      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not decode media.");
    } finally {
      setAnalyzing(false);
    }
  }, [previewUrl, title]);

  const grabVideoPoster = useCallback(async () => {
    const v = videoElRef.current;
    if (!v) return;
    try {
      v.currentTime = Math.min(1, v.duration * 0.1);
      await new Promise<void>((res) => {
        const onSeeked = () => {
          v.removeEventListener("seeked", onSeeked);
          res();
        };
        v.addEventListener("seeked", onSeeked);
      });
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/jpeg", 0.85),
      );
      if (blob) setPosterBlob(blob);
    } catch {
      /* poster optional */
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const submit = async () => {
    if (!user || !file) return;
    if (profile && !profile.terms_accepted) {
      setShowTerms(true);
      return;
    }
    if (!title.trim()) {
      setErr("Give it a title.");
      return;
    }
    setErr(null);
    setUploading(true);
    setProgress(10);
    try {
      const ext = file.name.split(".").pop() ?? (mediaType === "video" ? "mp4" : "mp3");
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage.from("audio").upload(path, file, {
        contentType: file.type || (mediaType === "video" ? "video/mp4" : "audio/mpeg"),
        upsert: false,
      });
      if (upErr) throw upErr;
      setProgress(60);
      const { data: pub } = supabase.storage.from("audio").getPublicUrl(path);

      let thumbnailUrl: string | null = null;
      if (mediaType === "video" && posterBlob) {
        const tPath = `${user.id}/posters/${Date.now()}.jpg`;
        const { error: tErr } = await supabase.storage
          .from("audio")
          .upload(tPath, posterBlob, { contentType: "image/jpeg", upsert: false });
        if (!tErr) {
          thumbnailUrl = supabase.storage.from("audio").getPublicUrl(tPath).data.publicUrl;
        }
      }
      setProgress(80);

      const { data: inserted, error: insErr } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          media_type: mediaType,
          media_url: pub.publicUrl,
          audio_url: pub.publicUrl, // keep alias populated
          thumbnail_url: thumbnailUrl,
          duration_seconds: duration,
          instrument_tag: instrument,
          visibility,
          comments_enabled: commentsEnabled,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      setProgress(100);
      void navigate({ to: "/post/$id", params: { id: inserted!.id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
      setUploading(false);
    }
  };

  return (
    <AppShell>
      {showTerms && (
        <TermsModal
          onAccepted={() => {
            setShowTerms(false);
            void refreshProfile();
          }}
          onCancel={() => navigate({ to: "/feed" })}
        />
      )}

      <div className="mb-4">
        <p className="label-tape text-primary">New post</p>
        <h1 className="text-2xl font-black">Drop a take</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Audio or video clip. Voice memos, riffs, performances, sketches — all welcome.
        </p>
      </div>

      {!file ? (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface p-10 text-center transition-colors hover:border-primary/60 hover:bg-surface-elevated cursor-pointer"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UploadIcon size={26} />
          </span>
          <p className="mt-4 font-semibold">Tap or drag a file here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Audio (.m4a .mp3 .wav) or video (.mp4 .mov .webm, max 60s / 50MB)
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                {mediaType === "video" ? (
                  <Video size={16} className="shrink-0 text-primary" />
                ) : (
                  <Music size={16} className="shrink-0 text-primary" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{file.name}</p>
                  <p className="label-tape text-muted-foreground">
                    {formatDuration(duration ?? 0)} · {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setWaveform(null);
                  setPosterBlob(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                aria-label="Remove"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4">
              {analyzing ? (
                <div className="h-14 animate-pulse rounded bg-surface-elevated" />
              ) : mediaType === "video" && previewUrl ? (
                <video
                  ref={videoElRef}
                  src={previewUrl}
                  className="aspect-video w-full rounded-lg bg-background object-contain"
                  controls
                  playsInline
                  onLoadedMetadata={() => void grabVideoPoster()}
                />
              ) : (
                <Waveform data={waveform} height={56} />
              )}
            </div>
          </div>

          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bedroom take #4"
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's it for? What do you want feedback on?"
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-surface px-4 py-2.5 focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={`Instrument · auto-suggested: ${instrument}`}>
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value as InstrumentTag)}
              className="w-full rounded-md border border-border bg-surface px-4 py-2.5 focus:border-primary focus:outline-none"
            >
              {INSTRUMENT_TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Who can see this?">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["public", "Public"],
                  ["followers", "Followers"],
                  ["private", "Only me"],
                ] as const
              ).map(([v, l]) => (
                <Toggle key={v} active={visibility === v} onClick={() => setVisibility(v)} label={l} />
              ))}
            </div>
          </Field>

          <Field label="Comments">
            <div className="grid grid-cols-2 gap-2">
              <Toggle
                active={commentsEnabled}
                onClick={() => setCommentsEnabled(true)}
                label="Comments on"
              />
              <Toggle
                active={!commentsEnabled}
                onClick={() => setCommentsEnabled(false)}
                label="Reactions only"
              />
            </div>
          </Field>

          {err && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </p>
          )}

          <button
            disabled={uploading || analyzing}
            onClick={submit}
            className="relative w-full overflow-hidden rounded-md bg-primary px-4 py-3.5 text-base font-bold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {uploading && (
              <span
                className="absolute inset-y-0 left-0 bg-primary-foreground/15"
                style={{ width: `${progress}%` }}
              />
            )}
            <span className="relative">
              {uploading ? `Uploading ${progress}%` : "Publish post"}
            </span>
          </button>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-tape mb-1.5 block text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "label-tape rounded-md border px-3 py-2 transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </button>
  );
}
