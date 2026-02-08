"use client";

import { useState, useRef, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const SIGNED_URL_TTL_SEC = 3600; // 1 hour for private bucket

type COAUploadProps = {
  productId: string;
  label: string;
  required?: boolean;
  /** Storage path (e.g. vendors/uid/products/id/coa/file.pdf) for signed URL; no public URL for private bucket */
  existingStoragePath?: string | null;
  onUploaded: (storagePath: string) => void;
  helperText?: string;
  disabled?: boolean;
};

export default function COAUpload({
  productId,
  label,
  required = false,
  existingStoragePath,
  onUploaded,
  helperText,
  disabled = false,
}: COAUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedViewUrl, setSignedViewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Private bucket: fetch signed URL for existing COA so vendor/admin can view
  useEffect(() => {
    if (!existingStoragePath || !existingStoragePath.trim()) {
      setSignedViewUrl(null);
      return;
    }
    const path = existingStoragePath.trim().replace(/^coas\//, "");
    let cancelled = false;
    createSupabaseBrowserClient()
      .storage.from("coas")
      .createSignedUrl(path, SIGNED_URL_TTL_SEC)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setSignedViewUrl(null);
          return;
        }
        setSignedViewUrl(data?.signedUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setSignedViewUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [existingStoragePath]);

  const validateFile = (file: File): string | null => {
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return "File must be PDF, PNG, JPG, or WEBP";
    }
    if (file.size > MAX_SIZE_BYTES) {
      return "File size must be less than 50MB";
    }
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/vendors/products/${productId}/coa`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Upload failed");
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const storagePath = data?.storage_path;
      if (!storagePath) {
        setError("Upload succeeded but no path returned");
        setUploading(false);
        return;
      }

      const path = storagePath.replace(/^coas\//, "");
      const { data: signed } = await createSupabaseBrowserClient()
        .storage.from("coas")
        .createSignedUrl(path, SIGNED_URL_TTL_SEC);
      setSignedViewUrl(signed?.signedUrl ?? null);
      onUploaded(storagePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    setSignedViewUrl(null);
    onUploaded("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      {signedViewUrl || existingStoragePath ? (
        <div className="space-y-2">
          {signedViewUrl ? (
            <a
              href={signedViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline text-sm block"
            >
              ✓ COA uploaded — View file →
            </a>
          ) : (
            <span className="text-sm text-muted">✓ COA on file — loading view link…</span>
          )}
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="text-red-400 hover:text-red-300 text-sm disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileSelect}
            disabled={uploading || disabled}
            className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent/80 disabled:opacity-50"
          />
          {uploading && <p className="text-xs text-muted">Uploading...</p>}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {helperText && <p className="text-muted text-sm">{helperText}</p>}
    </div>
  );
}
