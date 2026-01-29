"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type ProfileBasics = {
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  border_style: string | null;
};

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const borderOptions = [
  { value: "none", label: "None" },
  { value: "lime", label: "Lime" },
  { value: "orange", label: "Orange" },
  { value: "teal", label: "Teal" },
] as const;

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, "_");

export default function ProfileBasicsClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [profile, setProfile] = useState<ProfileBasics>({
    display_name: null,
    avatar_url: null,
    banner_url: null,
    border_style: "none",
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        const data = payload.profile || {};
        setProfile({
          display_name: data.display_name || null,
          avatar_url: data.avatar_url || null,
          banner_url: data.banner_url || null,
          border_style: data.border_style || "none",
        });
        setDisplayNameInput(data.display_name || "");
      }
      setLoading(false);
    };
    loadProfile();
  }, [supabase, userId]);

  const updateProfile = async (updates: Partial<ProfileBasics>) => {
    const nextProfile = { ...profile, ...updates };
    setProfile(nextProfile);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      setError("Failed to update profile.");
      setProfile(profile);
    }
  };

  const validateImage = (file: File) => {
    if (!IMAGE_TYPES.has(file.type)) {
      return "Images must be JPG, PNG, or WEBP.";
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return "Image must be under 10MB.";
    }
    return null;
  };

  const handleUpload = async (file: File, bucket: "profile-avatars" | "profile-banners") => {
    const validation = validateImage(file);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const safeName = sanitizeFileName(file.name);
      const unique = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());
      const path = `${userId}/${unique}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });
      if (uploadError) {
        throw uploadError;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (bucket === "profile-avatars") {
        await updateProfile({ avatar_url: data.publicUrl });
      } else {
        await updateProfile({ banner_url: data.publicUrl });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <section className="card-glass p-6">
        <p className="text-muted">Loading profile...</p>
      </section>
    );
  }

  return (
    <section className="card-glass p-6 space-y-4 profile-basics">
      <h2 className="text-xl font-semibold">Profile basics</h2>

      {profile.banner_url && (
        <div className="profile-banner">
          <img src={profile.banner_url} alt="Profile banner" />
        </div>
      )}

        <div className="profile-avatar-row">
        <div
          className={`profile-avatar ${profile.border_style ? `profile-avatar--${profile.border_style}` : ""}`}
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile avatar" />
          ) : (
            <span className="text-muted text-sm">No avatar</span>
          )}
        </div>

      <div className="space-y-2">
        <label className="text-sm text-muted">Display name</label>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={displayNameInput}
            onChange={(event) => setDisplayNameInput(event.target.value)}
            placeholder="Add your display name"
            className="flex-1 min-w-[220px] px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white text-sm"
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={savingName}
            onClick={async () => {
              setSavingName(true);
              await updateProfile({ display_name: displayNameInput.trim() || null });
              setSavingName(false);
            }}
          >
            {savingName ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
        <div className="space-y-2">
          <label className="text-sm text-muted">Avatar image</label>
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                handleUpload(file, "profile-avatars");
              }
            }}
            className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-white hover:file:bg-accent/80 disabled:opacity-60"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted">Banner image</label>
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              handleUpload(file, "profile-banners");
            }
          }}
          className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-white hover:file:bg-accent/80 disabled:opacity-60"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted">Avatar border style</label>
        <div className="flex flex-wrap gap-3">
          {borderOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateProfile({ border_style: option.value })}
              className={`filter-chip ${
                profile.border_style === option.value ? "filter-chip--active" : ""
              }`}
              disabled={uploading}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
