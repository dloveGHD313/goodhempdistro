"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import UploadField from "@/components/UploadField";

export default function DriverApplyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [driverLicenseUrl, setDriverLicenseUrl] = useState("");
  const [insuranceUrl, setInsuranceUrl] = useState("");
  const [mvrReportUrl, setMvrReportUrl] = useState("");
  const [licenseAttested, setLicenseAttested] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
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
      router.push("/login?redirect=/driver-apply");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Validate required documents
      if (!driverLicenseUrl || !insuranceUrl || !mvrReportUrl) {
        setError("All required documents must be uploaded (Driver License, Insurance, MVR Report)");
        setSubmitting(false);
        return;
      }

      const response = await fetch("/api/drivers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          city,
          state,
          vehicle_type: vehicleType,
          driver_license_url: driverLicenseUrl,
          insurance_url: insuranceUrl,
          mvr_report_url: mvrReportUrl,
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
        router.push("/driver/dashboard");
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

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold mb-6 text-accent">Apply to be a Delivery Driver</h1>
            <p className="text-muted mb-8">Join our local B2B delivery network and earn money making deliveries.</p>

            {!user && (
              <div className="card-glass p-6 mb-6">
                <p className="text-muted mb-4">You must be logged in to apply.</p>
                <Link href="/login?redirect=/driver-apply" className="btn-primary">
                  Login
                </Link>
              </div>
            )}

            {success ? (
              <div className="card-glass p-6 text-center">
                <h2 className="text-2xl font-bold mb-4 text-green-400">Application Submitted!</h2>
                <p className="text-muted mb-4">Your application is being reviewed. Redirecting to dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 card-glass p-8">
                {error && (
                  <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium mb-2">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-2">
                    Phone Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium mb-2">
                      City <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="state" className="block text-sm font-medium mb-2">
                      State <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                      maxLength={2}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white uppercase"
                      placeholder="CA"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="vehicle_type" className="block text-sm font-medium mb-2">
                    Vehicle Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="vehicle_type"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  >
                    <option value="">Select vehicle type</option>
                    <option value="Car">Car</option>
                    <option value="SUV">SUV</option>
                    <option value="Truck">Truck</option>
                    <option value="Van">Van</option>
                  </select>
                </div>

                <div className="border-t border-[var(--border)] pt-6 space-y-6">
                  <h3 className="text-lg font-semibold">Required Documents</h3>
                  <UploadField
                    bucket="driver-docs"
                    folderPrefix="drivers/license"
                    label="Driver License"
                    required
                    existingUrl={driverLicenseUrl || null}
                    onUploaded={(url) => setDriverLicenseUrl(url)}
                    helperText="Upload a clear image or PDF of your valid driver's license (max 10MB)"
                  />
                  <UploadField
                    bucket="driver-docs"
                    folderPrefix="drivers/insurance"
                    label="Insurance Certificate"
                    required
                    existingUrl={insuranceUrl || null}
                    onUploaded={(url) => setInsuranceUrl(url)}
                    helperText="Upload proof of current vehicle insurance (max 10MB)"
                  />
                  <UploadField
                    bucket="driver-docs"
                    folderPrefix="drivers/mvr"
                    label="MVR Report (Motor Vehicle Record)"
                    required
                    existingUrl={mvrReportUrl || null}
                    onUploaded={(url) => setMvrReportUrl(url)}
                    helperText="Upload your MVR report from DMV (max 10MB)"
                  />
                </div>

                <div className="space-y-3 border-t border-[var(--border)] pt-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={licenseAttested}
                      onChange={(e) => setLicenseAttested(e.target.checked)}
                      required
                      className="mt-1 w-4 h-4 accent-accent"
                    />
                    <span className="text-sm">
                      I have a valid driver's license and insurance <span className="text-red-400">*</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      required
                      className="mt-1 w-4 h-4 accent-accent"
                    />
                    <span className="text-sm">
                      I agree to the terms and conditions <span className="text-red-400">*</span>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !user}
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
