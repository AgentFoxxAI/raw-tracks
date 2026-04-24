import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { AvatarUploader } from "@/components/AvatarUploader";
import { INSTRUMENT_TAGS } from "@/lib/instrument";

export const Route = createFileRoute("/profile/edit")({
  component: ProfileEditPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
});

function ProfileEditPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [influences, setInfluences] = useState("");
  const [collabStatus, setCollabStatus] = useState<"open" | "selective" | "closed">("closed");
  const [instruments, setInstruments] = useState<string[]>([]);
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setLocation(profile.location ?? "");
    setInfluences(profile.influences ?? "");
    setCollabStatus(profile.collab_status);
    setInstruments(profile.instruments);
    setLinks(profile.links);
  }, [profile]);

  const toggleInstrument = (i: string) => {
    setInstruments((prev) => (prev.includes(i) ? prev.filter((p) => p !== i) : [...prev, i]));
  };

  const addLink = () => setLinks((p) => [...p, { label: "", url: "" }]);
  const removeLink = (idx: number) => setLinks((p) => p.filter((_, i) => i !== idx));
  const updateLink = (idx: number, key: "label" | "url", val: string) =>
    setLinks((p) => p.map((l, i) => (i === idx ? { ...l, [key]: val } : l)));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setErr(null);
    const cleanLinks = links.filter((l) => l.url.trim().length > 0);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        influences: influences.trim() || null,
        collab_status: collabStatus,
        instruments,
        links: cleanLinks,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await refreshProfile();
    void navigate({ to: "/profile" });
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="label-tape text-primary">Profile</p>
          <h1 className="text-2xl font-black">Edit your profile</h1>
        </div>
        <button
          onClick={() => navigate({ to: "/profile" })}
          className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"
          aria-label="Cancel"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5">
        <Field label="Avatar">
          <div className="flex items-center gap-4">
            <AvatarUploader
              avatarUrl={profile?.avatar_url}
              fallback={(displayName || profile?.username || "?").slice(0, 1).toUpperCase()}
              size={80}
              variant="ring"
            />
            <div>
              <p className="text-sm font-semibold">Tap to change photo</p>
              <p className="label-tape mt-1 text-muted-foreground">JPG / PNG / WebP · max 5MB · square works best</p>
            </div>
          </div>
        </Field>

        <Field label="Display name">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="The name people see"
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 focus:border-primary focus:outline-none"
          />
        </Field>

        <Field label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Who are you, what do you make?"
            rows={4}
            maxLength={500}
            className="w-full resize-none rounded-md border border-border bg-surface px-4 py-2.5 focus:border-primary focus:outline-none"
          />
          <p className="label-tape mt-1 text-right text-muted-foreground">{bio.length}/500</p>
        </Field>

        <Field label="Location">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Brooklyn, NY"
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 focus:border-primary focus:outline-none"
          />
        </Field>

        <Field label="Influences / style">
          <input
            value={influences}
            onChange={(e) => setInfluences(e.target.value)}
            placeholder="Lo-fi hip hop, dream pop, krautrock"
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 focus:border-primary focus:outline-none"
          />
        </Field>

        <Field label="Instruments">
          <div className="flex flex-wrap gap-2">
            {INSTRUMENT_TAGS.map((i) => {
              const active = instruments.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleInstrument(i)}
                  className={
                    "label-tape rounded-full border px-3 py-1.5 transition-colors " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground")
                  }
                >
                  {i}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Collaboration status">
          <div className="grid grid-cols-3 gap-2">
            {(["open", "selective", "closed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setCollabStatus(s)}
                className={
                  "label-tape rounded-md border px-3 py-2 transition-colors " +
                  (collabStatus === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground")
                }
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Links">
          <div className="space-y-2">
            {links.map((l, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={l.label}
                  onChange={(e) => updateLink(idx, "label", e.target.value)}
                  placeholder="Bandcamp"
                  className="w-1/3 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <input
                  value={l.url}
                  onChange={(e) => updateLink(idx, "url", e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeLink(idx)}
                  className="rounded-md border border-border p-2 text-muted-foreground hover:text-destructive"
                  aria-label="Remove link"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLink}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary"
            >
              <Plus size={14} /> Add link
            </button>
          </div>
        </Field>

        {err && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </p>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-md bg-primary px-4 py-3.5 text-base font-bold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
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
