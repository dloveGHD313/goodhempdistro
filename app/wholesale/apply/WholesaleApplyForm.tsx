"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BUSINESS_TYPES = [
  { value: "hotel", label: "Hotel" },
  { value: "apartment_multifamily", label: "Apartment / Multifamily" },
  { value: "retail_store", label: "Retail store" },
  { value: "restaurant", label: "Restaurant" },
  { value: "distributor", label: "Distributor" },
  { value: "other", label: "Other" },
  { value: "na_personal", label: "N/A (personal use)" },
] as const;

const COMPANY_SIZES = [
  { value: "na", label: "N/A" },
  { value: "1-5", label: "1–5" },
  { value: "6-25", label: "6–25" },
  { value: "26-100", label: "26–100" },
  { value: "100+", label: "100+" },
] as const;

const PRODUCTS_SOURCING = [
  { value: "cbd", label: "CBD / wellness" },
  { value: "building", label: "Hemp building" },
  { value: "food", label: "Food & beverage" },
  { value: "textiles", label: "Textiles" },
  { value: "other", label: "Other" },
] as const;

const ALLOWED_EXT = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];

export type WholesaleApplyPrefill = {
  business_name?: string | null;
  business_type?: string | null;
  company_size?: string | null;
  products_sourcing?: string[] | null;
};

export default function WholesaleApplyForm({ prefill }: { prefill?: WholesaleApplyPrefill }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(prefill?.business_name ?? "");
  const [businessType, setBusinessType] = useState(prefill?.business_type ?? "");
  const [companySize, setCompanySize] = useState(prefill?.company_size ?? "");
  const [productsSourcing, setProductsSourcing] = useState<string[]>(prefill?.products_sourcing ?? []);
  const [certificatePath, setCertificatePath] = useState<string | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleProduct = (value: string) => {
    setProductsSourcing((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setCertificateFile(null);
      setCertificatePath(null);
      return;
    }
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setError("Allowed: PDF, PNG, JPG, JPEG, WEBP");
      setCertificateFile(null);
      setCertificatePath(null);
      return;
    }
    setError(null);
    setCertificateFile(file);
    setCertificatePath(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let path = certificatePath;
    if (certificateFile && certificateFile.size > 0 && !path) {
      setSubmitting(true);
      try {
        const uploadRes = await fetch("/api/wholesale/applications/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: certificateFile.name,
            contentType: certificateFile.type || "application/octet-stream",
          }),
        });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to get upload URL");
        }
        const { signedUrl, path: returnedPath } = await uploadRes.json();
        if (!signedUrl || !returnedPath) throw new Error("Invalid upload URL response");
        const putRes = await fetch(signedUrl, {
          method: "PUT",
          body: certificateFile,
          headers: { "Content-Type": certificateFile.type || "application/octet-stream" },
        });
        if (!putRes.ok) throw new Error("Upload failed");
        path = returnedPath;
        setCertificatePath(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Certificate upload failed");
        setSubmitting(false);
        return;
      }
    }

    if (!path && certificateFile?.size) {
      setError("Please wait for the certificate to finish uploading, or re-select the file.");
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wholesale/applications/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName.trim() || null,
          business_type: businessType || null,
          company_size: companySize || null,
          products_sourcing: productsSourcing.length ? productsSourcing : null,
          certificate_path: path,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Submit failed");
        setSubmitting(false);
        return;
      }
      router.push("/wholesale");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded bg-red-500/20 text-red-200 text-sm" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="business_name" className="block text-sm font-medium text-muted mb-1">
          Business name
        </label>
        <input
          id="business_name"
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="input-shell w-full"
          placeholder="Your business or company name"
        />
      </div>

      <div>
        <label htmlFor="business_type" className="block text-sm font-medium text-muted mb-1">
          Business type
        </label>
        <select
          id="business_type"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          className="input-shell w-full"
        >
          <option value="">Select...</option>
          {BUSINESS_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="company_size" className="block text-sm font-medium text-muted mb-1">
          Company size
        </label>
        <select
          id="company_size"
          value={companySize}
          onChange={(e) => setCompanySize(e.target.value)}
          className="input-shell w-full"
        >
          <option value="">Select...</option>
          {COMPANY_SIZES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="block text-sm font-medium text-muted mb-2">Products you source (optional)</span>
        <div className="flex flex-wrap gap-2">
          {PRODUCTS_SOURCING.map((o) => (
            <label key={o.value} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={productsSourcing.includes(o.value)}
                onChange={() => toggleProduct(o.value)}
                className="rounded border border-white/30"
              />
              <span className="text-sm">{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="certificate" className="block text-sm font-medium text-muted mb-1">
          Resale / wholesale certificate (PDF or image)
        </label>
        <input
          id="certificate"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={handleFileChange}
          className="input-shell w-full"
        />
        {certificateFile && (
          <p className="text-xs text-muted mt-1">
            {certificatePath ? "Uploaded. Ready to submit." : `Selected: ${certificateFile.name} (will upload on submit)`}
          </p>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit application"}
        </button>
        <Link href="/wholesale" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
