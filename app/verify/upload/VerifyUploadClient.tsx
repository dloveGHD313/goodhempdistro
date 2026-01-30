"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Props = {
  userId: string;
};

export default function VerifyUploadClient({ userId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files || []);
    setFiles(next);
  };

  const handleSubmit = async () => {
    setError(null);
    if (files.length === 0) {
      setError("Please select at least one ID image or document.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: verification, error: verificationError } = await supabase
        .from("id_verifications")
        .insert({ user_id: userId, status: "pending" })
        .select("id")
        .single();

      if (verificationError || !verification) {
        throw new Error(verificationError?.message || "Failed to create verification request.");
      }

      const uploadResults = await Promise.all(
        files.map(async (file) => {
          const safeName = file.name.replace(/\s+/g, "-");
          const path = `${userId}/${Date.now()}-${safeName}`;
          const { error: uploadError } = await supabase
            .storage
            .from("id-verifications")
            .upload(path, file, { upsert: false });
          if (uploadError) {
            throw uploadError;
          }
          const { error: insertError } = await supabase
            .from("id_verification_files")
            .insert({
              verification_id: verification.id,
              file_url: path,
              file_path: path,
            });
          if (insertError) {
            throw insertError;
          }
          return path;
        })
      );

      if (uploadResults.length === 0) {
        throw new Error("No files were uploaded.");
      }

      router.replace("/verify-age/status");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload verification.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto card-glass p-8 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted mb-2">ID Upload</p>
        <h1 className="text-3xl font-bold text-accent mb-2">Upload your government ID</h1>
        <p className="text-muted">
          Upload a clear photo of a government-issued ID. We review submissions manually.
        </p>
      </div>

      {error && (
        <div className="card-glass p-4 border border-red-500/40 text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <label className="block text-sm text-muted">ID files</label>
        <input
          type="file"
          accept="image/*,application/pdf,.heic,.heif"
          multiple
          onChange={handleFilesChange}
          className="w-full text-sm text-muted"
        />
        <p className="text-xs text-muted">
          Accepted: JPG, PNG, HEIC, PDF. Upload front and back if applicable.
        </p>
      </div>

      {files.length > 0 && (
        <ul className="text-sm text-muted space-y-1">
          {files.map((file) => (
            <li key={file.name}>{file.name}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Uploading..." : "Submit for Review"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.push("/verify-age/status")}
          disabled={submitting}
        >
          Check Status
        </button>
      </div>
    </div>
  );
}
