"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type ImportResult = {
  ok: boolean;
  totals: { rows: number; valid: number; inserted: number; updated: number };
  errors: { rowNumber: number; field: string; message: string }[];
  failed_writes: { rowNumber: number; field: string; message: string }[];
};

const TEMPLATE_HEADERS = [
  "vendor_id",
  "name",
  "description",
  "price_cents",
  "category_slug",
  "product_type",
  "image_url",
  "coa_url",
  "ship_to_states",
  "status",
  "hemp_derived_attestation",
  "delta8_disclaimer_ack",
];

const SAMPLE_ROW = [
  "00000000-0000-0000-0000-000000000000", // vendor_id (replace with real)
  "Sample Hemp Tincture 30ml",
  "Full-spectrum hemp tincture, 1000mg total CBD",
  "4999",
  "tinctures",
  "non_intoxicating",
  "https://your-supabase-bucket.supabase.co/storage/v1/object/public/product-images/path.jpg",
  "https://your-supabase-bucket.supabase.co/storage/v1/object/public/coas/path.pdf",
  "CA,CO,OR,WA,TX",
  "pending_review",
  "true",
  "",
];

function buildTemplateCsv(): string {
  return [
    TEMPLATE_HEADERS.join(","),
    SAMPLE_ROW.map((v) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)).join(","),
  ].join("\n");
}

export default function CatalogImportClient() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      setCsvContent(text);
    } catch {
      setError("Failed to read file");
    }
  };

  const handleSubmit = async () => {
    if (!csvContent.trim()) {
      setError("No CSV content to import");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/catalog-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.totals) {
        setError(data?.error || `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      setResult(data as ImportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalog-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setCsvContent("");
    setFilename("");
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-[#0D1512] text-[#F0EDE6]">
      <main className="container mx-auto max-w-4xl px-6 py-12">
        <nav className="text-sm text-[#8A9E96] mb-4">
          <Link href="/admin" className="hover:text-[#F0EDE6]">Admin</Link>
          <span className="mx-2">/</span>
          <span>Catalog Import</span>
        </nav>

        <h1 className="text-3xl font-serif mb-2">Catalog Import</h1>
        <p className="text-[#8A9E96] mb-8">
          Bulk-import the anchor catalog via CSV. Rows are upserted on
          (vendor_id, name) — re-uploading a row with the same vendor + name
          updates the existing product instead of creating a duplicate.
        </p>

        <section className="rounded-xl border border-white/10 bg-[#141F1A] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">1. Get the template</h2>
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-[#3CB97A]/40 bg-[#3CB97A]/10 px-4 py-2 text-sm text-[#3CB97A] hover:bg-[#3CB97A]/20"
          >
            Download CSV template
          </button>
          <p className="text-xs text-[#8A9E96] mt-3 leading-relaxed">
            Required columns: <code>vendor_id</code>, <code>name</code>, <code>price_cents</code>,
            <code>category_slug</code>, <code>product_type</code>, <code>image_url</code>,
            <code>ship_to_states</code>, <code>hemp_derived_attestation</code>.
            Conditionally required: <code>coa_url</code> (when category requires COA),
            <code>delta8_disclaimer_ack</code> (when product_type=delta8). Optional:
            <code>description</code>, <code>status</code> (defaults to <code>pending_review</code>).
          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#141F1A] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">2. Upload your CSV</h2>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-[#8A9E96] file:mr-4 file:rounded-lg file:border-0 file:bg-[#3CB97A]/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#3CB97A] hover:file:bg-[#3CB97A]/25"
          />
          {filename && (
            <p className="text-xs text-[#8A9E96] mt-3">
              Selected: <span className="text-[#F0EDE6]">{filename}</span>
              {" "}({csvContent.length.toLocaleString()} chars,{" "}
              {csvContent.split(/\r?\n/).filter((l) => l.trim()).length} non-blank lines)
            </p>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-[#141F1A] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">3. Run import</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!csvContent.trim() || submitting}
              className="rounded-lg bg-[#3CB97A] px-5 py-2 text-sm font-semibold text-[#0D1512] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? "Importing…" : "Import catalog"}
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={submitting}
              className="rounded-lg border border-white/15 px-5 py-2 text-sm text-[#8A9E96] hover:border-white/30 hover:text-[#F0EDE6]"
            >
              Clear
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300 mb-6">
            {error}
          </div>
        )}

        {result && (
          <section className="rounded-xl border border-white/10 bg-[#141F1A] p-6">
            <h2 className="text-lg font-semibold mb-4">
              {result.ok ? "Import complete ✅" : "Import finished with issues ⚠️"}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Stat label="Rows in CSV" value={result.totals.rows} />
              <Stat label="Valid" value={result.totals.valid} />
              <Stat label="Inserted" value={result.totals.inserted} accent />
              <Stat label="Updated" value={result.totals.updated} accent />
            </div>

            {result.errors.length > 0 && (
              <details open className="mb-4">
                <summary className="cursor-pointer text-sm font-semibold text-yellow-300 mb-2">
                  Validation errors ({result.errors.length})
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="text-left text-[#8A9E96] border-b border-white/10">
                        <th className="py-2 pr-3">Row</th>
                        <th className="py-2 pr-3">Field</th>
                        <th className="py-2">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-1.5 pr-3 text-[#F0EDE6]">{e.rowNumber}</td>
                          <td className="py-1.5 pr-3 text-yellow-200">{e.field}</td>
                          <td className="py-1.5 text-[#8A9E96]">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {result.failed_writes.length > 0 && (
              <details open>
                <summary className="cursor-pointer text-sm font-semibold text-red-300 mb-2">
                  Failed DB writes ({result.failed_writes.length})
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="text-left text-[#8A9E96] border-b border-white/10">
                        <th className="py-2 pr-3">Row</th>
                        <th className="py-2">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.failed_writes.map((e, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-1.5 pr-3 text-[#F0EDE6]">{e.rowNumber}</td>
                          <td className="py-1.5 text-[#8A9E96]">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0D1512] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[#8A9E96] mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? "text-[#3CB97A]" : "text-[#F0EDE6]"}`}>{value}</p>
    </div>
  );
}
