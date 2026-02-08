"use client";

import { useState, useRef } from "react";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

type COAUploadProps = {
  productId: string;
  label: string;
  required?: boolean;
  existingUrl?: string | null;
  onUploaded: (storagePath: string) => void;
  helperText?: string;
  disabled?: boolean;
};

export default function COAUpload({
  productId,
  label,
  required = false,
  existingUrl,
  onUploaded,
  helperText,
  disabled = false,
}: COAUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const displayUrl = baseUrl
        ? `${baseUrl}/storage/v1/object/public/coas/${storagePath.replace(/^coas\//, "")}`
        : null;
      setUploadedUrl(displayUrl);
      onUploaded(storagePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    setUploadedUrl(null);
    onUploaded("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      {uploadedUrl ? (
        <div className="space-y-2">
          <a
            href={uploadedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline text-sm block"
          >
            ✓ COA uploaded — View file →
          </a>
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
