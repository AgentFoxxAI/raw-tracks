import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Upload as UploadIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { TermsModal } from "@/components/TermsModal";
import { Waveform } from "@/components/Waveform";
import {
  INSTRUMENT_TAGS,
  type InstrumentTag,
  audioBufferToWav,
  fileToAudioBuffer,
  formatDuration,
  generateWaveformData,
  suggestInstrumentFromBuffer,
} from "@/lib/instrument";

const searchSchema = z.object({
  parent: z.string().optional(),
});

export const Route = createFileRoute("/upload")({
  validateSearch: zodValidator(searchSchema),
  component: UploadPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

const ACCEPTED = ".m4a,.mp3,.wav,.mp4,.mov,audio/*,video/*";

function UploadPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { parent } = Route.useSearch();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [showTerms, setShowTerms] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [waveform, setWaveform] = useState<number[] | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instrument, setInstrument] = useState<InstrumentTag>("other");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [license, setLicense] = useState<"collaborate" | "free_to_use" | "private">("collaborate");
  const [parentTitle, setParentTitle] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !profile.terms_accepted) setShowTerms(true);
  }, [profile]);

  useEffect(() => {
    if (!parent) return;
    void supabase
      .from("offcuts")
      .select("title")
      .eq("id", parent)
      .maybeSingle()
      .then(({ data }) => setParentTitle(data?.title ?? null));
  }, [parent]);

  const handleFile = useCallback(async (f: File) => {
    setErr(null);
    setFile(f);
    setAnalyzing(true);
    try {
      const buffer = await fileToAudioBuffer(f);
      setDuration(buffer.duration);
      setWaveform(generateWaveformData(buffer));
      setInstrument(suggestInstrumentFromBuffer(buffer));
      // For video files extract audio as WAV; otherwise upload original.
      if (f.type.startsWith("video/")) {
        const wavBlob = audioBufferToWav(buffer);
        setAudioBlob(wavBlob);
      } else {
        setAudioBlob(f);
      }
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not decode audio.");
    } finally {
      setAnalyzing(false);
    }
  }, [title]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const submit = async () => {
    if (!user || !audioBlob || !file) return;
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
      const ext = audioBlob.type.includes("wav") ? "wav" : file.name.split(".").pop() ?? "mp3";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("audio").upload(path, audioBlob, {
        contentType: audioBlob.type || "audio/mpeg",
        upsert: false,
      });
      if (upErr) throw upErr;
      setProgress(70);
      const { data: pub } = supabase.storage.from("audio").getPublicUrl(path);

      const { data: inserted, error: insErr } = await supabase
        .from("offcuts")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          audio_url: pub.publicUrl,
          duration_seconds: duration,
          instrument_tag: instrument,
          visibility,
          license_type: license,
          waveform_data: waveform,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      if (parent && inserted) {
        await supabase.from("stacks").insert({
          parent_offcut_id: parent,
          child_offcut_id: inserted.id,
          created_by_user_id: user.id,
        });
      }
      setProgress(100);
      void navigate({ to: "/offcut/$id", params: { id: inserted!.id } });
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
        <p className="label-tape text-primary">{parent ? "Stacking on" : "New upload"}</p>
        <h1 className="text-2xl font-black">
          {parent ? parentTitle ?? "Adding a layer" : "Drop a take"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Audio or video — we'll grab the audio. Mid-take coughs encouraged.
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
          <p className="mt-1 text-xs text-muted-foreground">.m4a, .mp3, .wav, .mp4, .mov</p>
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
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="label-tape text-muted-foreground">
                  {formatDuration(duration ?? 0)} · {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setAudioBlob(null);
                  setWaveform(null);
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

          <Field label="Visibility">
            <div className="flex gap-2">
              {(["public", "private"] as const).map((v) => (
                <Toggle
                  key={v}
                  active={visibility === v}
                  onClick={() => setVisibility(v)}
                  label={v}
                />
              ))}
            </div>
          </Field>

          <Field label="License">
            <div className="grid grid-cols-3 gap-2">
              {([
                ["collaborate", "Collab"],
                ["free_to_use", "Free use"],
                ["private", "Private"],
              ] as const).map(([v, l]) => (
                <Toggle key={v} active={license === v} onClick={() => setLicense(v)} label={l} />
              ))}
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
              {uploading ? `Uploading ${progress}%` : parent ? "Stack it" : "Publish offcut"}
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
