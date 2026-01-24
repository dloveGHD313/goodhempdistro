"use client";

import { useState, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type UploadFieldProps = {
  bucket: string;
  folderPrefix: string;
  label: string;
  accept?: string;
  required?: boolean;
  existingUrl?: string | null;
  onUploaded: (url: string) => void;
  helperText?: string;
  userId?: string;
};

export default function UploadField({
  bucket,
  folderPrefix,
  label,
  accept = ".pdf,.png,.jpg,.jpeg,.webp",
  required = false,
  existingUrl,
  onUploaded,
  helperText,
  userId,
}: UploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    const maxSize = 50 * 1024 * 1024; // 50MB (configurable via env if needed)

    if (!validTypes.includes(file.type)) {
      return "File must be PDF, PNG, JPG, or JPEG";
    }

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      return `File size must be less than ${maxSizeMB}MB`;
    }

    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      // Get user ID
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user && !userId) {
        throw new Error("User must be authenticated to upload files");
      }

      const userForUpload = userId || user?.id;
      if (!userForUpload) {
        throw new Error("User ID required");
      }

      const logUpload = (payload: {
        event: "attempt" | "error";
        bucket: string;
        key: string;
        errorCode?: string | null;
      }) => {
        if (process.env.NODE_ENV === "production") {
          return;
        }
        void fetch("/api/_debug/storage-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      };

      // Generate safe filename
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const uniquePrefix =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(timestamp);
      const isCoaBucket = bucket === "coas";
      const filePath = isCoaBucket
        ? `${userForUpload}/${uniquePrefix}_${safeFileName}`
        : `${folderPrefix}/${userForUpload}/${timestamp}-${safeFileName}`;

      logUpload({ event: "attempt", bucket, key: filePath });

      // Upload file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          upsert: false,
          cacheControl: "3600",
        });

      if (uploadError) {
        const errorCode =
          uploadError && typeof uploadError === "object" && "code" in uploadError
            ? String((uploadError as { code?: string }).code || "")
            : null;
        logUpload({
          event: "error",
          bucket,
          key: filePath,
          errorCode,
        });
        throw uploadError;
      }

      // For private buckets (driver-docs, logistics-docs), store the path
      const isPrivateBucket = bucket === "driver-docs" || bucket === "logistics-docs";
      
      if (isCoaBucket) {
        const { data: signedUrl } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 5);
        const fallbackUrl = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath).data.publicUrl;
        setUploadedUrl(signedUrl?.signedUrl || fallbackUrl);
        setUploadProgress(100);
        onUploaded(filePath);
        setUploading(false);
      } else if (isPrivateBucket) {
        // Store path for private buckets
        const storedValue = `${bucket}/${filePath}`;
        setUploadedUrl(storedValue); // Display shows path, but component can differentiate
        setUploadProgress(100);
        onUploaded(storedValue);
      } else {
        // For public buckets, use public URL
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);
        setUploadedUrl(publicUrl);
        setUploadProgress(100);
        onUploaded(publicUrl);
        setUploading(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setError(errorMessage);
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
            ✓ Document uploaded - View file →
          </a>
          <button
            type="button"
            onClick={() => {
              setUploadedUrl(null);
              onUploaded("");
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={uploading}
            className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent/80 disabled:opacity-50"
          />
          {uploading && (
            <div className="space-y-1">
              <div className="w-full bg-[var(--surface)] rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted">Uploading... {uploadProgress}%</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {helperText && (
        <p className="text-muted text-sm">{helperText}</p>
      )}
    </div>
  );
}