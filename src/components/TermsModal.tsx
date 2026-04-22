import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const TERMS_TEXT =
  "By uploading, you grant collaborators the right to build on this Offcut within the Offcuts platform. Ownership remains with the original creator unless otherwise agreed.";

interface TermsModalProps {
  onAccepted: () => void;
  onCancel?: () => void;
}

export function TermsModal({ onAccepted, onCancel }: TermsModalProps) {
  const { user, refreshProfile } = useAuth();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accept = async () => {
    if (!user) return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("profiles")
      .update({ terms_accepted: true })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await refreshProfile();
    onAccepted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-surface p-6">
        <p className="label-tape text-primary">Before you upload</p>
        <h2 className="mt-2 text-xl font-bold">Collaboration Terms</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{TERMS_TEXT}</p>

        <label className="mt-6 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-border bg-background accent-primary"
          />
          <span className="text-sm">I understand and accept these terms.</span>
        </label>

        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

        <div className="mt-6 flex gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-elevated"
            >
              Cancel
            </button>
          )}
          <button
            onClick={accept}
            disabled={!checked || saving}
            className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving..." : "Accept & continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
