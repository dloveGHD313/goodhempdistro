"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import UploadField from "@/components/UploadField";

export default function LogisticsApplyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [companyName, setCompanyName] = useState("");
  const [authorityUrl, setAuthorityUrl] = useState("");
  const [insuranceCertUrl, setInsuranceCertUrl] = useState("");
  const [w9Url, setW9Url] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      router.push("/login?redirect=/logistics/apply");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Validate required documents
      if (!authorityUrl || !insuranceCertUrl) {
        setError("Authority URL and Insurance Certificate are required");
        setSubmitting(false);
        return;
      }

      const response = await fetch("/api/logistics/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          authority_url: authorityUrl,
          insurance_cert_url: insuranceCertUrl,
          w9_url: w9Url || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit application");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/logistics");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <p className="text-muted">Loading...</p>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-2xl mx-auto text-center">
              <h1 className="text-4xl font-bold mb-6 text-accent">Logistics Registration</h1>
              <p className="text-muted mb-4">You must be logged in to register.</p>
              <Link href="/login?redirect=/logistics/apply" className="btn-primary">
                Login
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold mb-6 text-accent">Logistics Registration</h1>
            <p className="text-muted mb-8">Register your logistics company for B2B delivery services.</p>

            {success ? (
              <div className="card-glass p-6 text-center">
                <h2 className="text-2xl font-bold mb-4 text-green-400">Application Submitted!</h2>
                <p className="text-muted mb-4">Your application is being reviewed. Redirecting...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 card-glass p-8">
                {error && (
                  <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="company_name" className="block text-sm font-medium mb-2">
                    Company Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="company_name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  />
                </div>

                <div className="border-t border-[var(--border)] pt-6 space-y-6">
                  <h3 className="text-lg font-semibold">Required Documents</h3>
                  <UploadField
                    bucket="logistics-docs"
                    folderPrefix="logistics/authority"
                    label="DOT/MC Authority Document"
                    required
                    existingUrl={authorityUrl || null}
                    onUploaded={(url) => setAuthorityUrl(url)}
                    helperText="Upload your DOT/MC authority document (max 10MB)"
                  />
                  <UploadField
                    bucket="logistics-docs"
                    folderPrefix="logistics/insurance"
                    label="Insurance Certificate"
                    required
                    existingUrl={insuranceCertUrl || null}
                    onUploaded={(url) => setInsuranceCertUrl(url)}
                    helperText="Upload proof of commercial insurance (max 10MB)"
                  />
                  <UploadField
                    bucket="logistics-docs"
                    folderPrefix="logistics/w9"
                    label="W-9 Form (Optional)"
                    existingUrl={w9Url || null}
                    onUploaded={(url) => setW9Url(url)}
                    helperText="Upload W-9 form for tax purposes (optional, max 10MB)"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
