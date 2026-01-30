"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Props = {
  userId: string;
  existingVerificationId?: string | null;
  existingStatus?: "pending" | "approved" | "rejected" | "none" | null;
};

export default function VerifyUploadClient({
  userId,
  existingVerificationId = null,
  existingStatus = null,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(existingVerificationId);

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files || []);
    setFiles(next);
  };

  const handleSubmit = async () => {
    setError(null);
    if (existingStatus === "approved") {
      setError("You are already verified. No upload is needed.");
      return;
    }
    if (files.length === 0) {
      setError("Please select at least one ID image or document.");
      return;
    }

    setSubmitting(true);
    try {
      let activeVerificationId = verificationId;
      if (!activeVerificationId) {
        const { data: verification, error: verificationError } = await supabase
          .from("id_verifications")
          .insert({ user_id: userId, status: "pending" })
          .select("id")
          .single();

        if (verificationError || !verification) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[verify-age] create verification failed", verificationError);
          }
          throw new Error("We couldn't start your verification. Please try again.");
        }
        activeVerificationId = verification.id;
        setVerificationId(activeVerificationId);
      }

      const uploaded: string[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/\s+/g, "-");
        const path = `${userId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase
          .storage
          .from("id-verifications")
          .upload(path, file, { upsert: false });
        if (uploadError) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[verify-age] upload failed", uploadError);
          }
          throw new Error("Upload failed. Please retry.");
        }
        const { error: insertError } = await supabase
          .from("id_verification_files")
          .insert({
            verification_id: activeVerificationId,
            file_url: path,
            file_path: path,
          });
        if (insertError) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[verify-age] file row insert failed", insertError);
          }
          throw new Error("We couldn't save your upload. Please retry.");
        }
        uploaded.push(path);
      }

      if (uploaded.length === 0) {
        throw new Error("No files were uploaded. Please try again.");
      }

      router.replace("/verify-age/status");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Upload failed.";
      const safeMessage = /timeout/i.test(raw)
        ? "Upload timed out. Please try again."
        : "Upload failed. Please try again.";
      setError(safeMessage);
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
        {existingStatus === "pending" && (
          <p className="text-xs text-yellow-200 mt-2">
            We already have a pending verification. You can add more files if needed.
          </p>
        )}
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
