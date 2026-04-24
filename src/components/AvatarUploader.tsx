import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface Props {
  /** Current avatar URL (already cache-busted if needed) */
  avatarUrl: string | null | undefined;
  /** Letter to fall back to when no image */
  fallback: string;
  /** Pixel size of the avatar circle */
  size?: number;
  /** Render mode: "ring" shows it large with hover overlay; "compact" is small with tiny camera badge */
  variant?: "ring" | "compact";
  className?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;

export function AvatarUploader({
  avatarUrl,
  fallback,
  size = 96,
  variant = "ring",
  className,
}: Props) {
  const { user, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image", { description: "JPG, PNG, or WebP." });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large", { description: "Max 5MB. Try compressing it." });
      return;
    }
    setUploading(true);
    try {
      // Path MUST start with the user's id folder so storage RLS allows the write.
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: true,
          cacheControl: "0",
        });
      if (upErr) {
        console.error("[AvatarUploader] upload failed", upErr);
        throw upErr;
      }

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the browser/CDN serves the new image immediately.
      const finalUrl = `${pub.publicUrl}?v=${Date.now()}`;

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: finalUrl })
        .eq("id", user.id);
      if (updErr) {
        console.error("[AvatarUploader] profile update failed", updErr);
        throw updErr;
      }

      await refreshProfile();
      toast.success("Avatar updated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      toast.error("Avatar upload failed", { description: msg });
    } finally {
      setUploading(false);
      // Reset so re-selecting the same file fires onChange again.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const dim = { width: size, height: size };

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading || !user}
        aria-label="Change avatar"
        className={cn(
          "group relative flex items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground transition-opacity",
          variant === "ring" && "ring-2 ring-border hover:ring-primary",
          uploading && "opacity-70",
        )}
        style={dim}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
        ) : (
          <span
            className="font-black"
            style={{ fontSize: Math.max(14, size * 0.35) }}
          >
            {fallback}
          </span>
        )}

        {/* Hover overlay (ring variant) */}
        {variant === "ring" && (
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-background/60 text-foreground opacity-0 transition-opacity",
              "group-hover:opacity-100 group-focus-visible:opacity-100",
              uploading && "opacity-100",
            )}
          >
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
          </span>
        )}

        {/* Compact badge */}
        {variant === "compact" && (
          <span
            className={cn(
              "absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground",
            )}
          >
            {uploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}
