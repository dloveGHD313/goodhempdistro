"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type VendorType = "farmer" | "wholesaler" | "retailer" | "service_provider";

type InitialVendor = {
  id: string;
  business_name: string | null;
  vendor_type: VendorType | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  state: string | null;
  city: string | null;
  service_areas: string[] | null;
  vendor_onboarding_step: number | null;
  vendor_onboarding_completed: boolean | null;
  terms_accepted_at: string | null;
  compliance_acknowledged_at: string | null;
  is_active: boolean | null;
  is_approved: boolean | null;
  status: string | null;
};

type Props = {
  initialVendor: InitialVendor;
  initialError?: string | null;
};

const VENDOR_TYPES: { value: VendorType; label: string; description: string }[] = [
  { value: "farmer", label: "Farmer", description: "Cultivation and farm-direct supply." },
  { value: "wholesaler", label: "Wholesaler", description: "Bulk distribution and supply." },
  { value: "retailer", label: "Retailer", description: "Retail storefronts and direct sales." },
  { value: "service_provider", label: "Service Provider", description: "Lab, logistics, marketing, or services." },
];

export default function VendorOnboardingClient({ initialVendor, initialError }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [currentStep, setCurrentStep] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [animateIn, setAnimateIn] = useState(true);

  const [vendorType, setVendorType] = useState<VendorType | "">(
    initialVendor.vendor_type || ""
  );
  const [businessName, setBusinessName] = useState(initialVendor.business_name || "");
  const [contactEmail, setContactEmail] = useState(initialVendor.contact_email || "");
  const [contactPhone, setContactPhone] = useState(initialVendor.contact_phone || "");
  const [website, setWebsite] = useState(initialVendor.website || "");
  const [stateValue, setStateValue] = useState(initialVendor.state || "");
  const [city, setCity] = useState(initialVendor.city || "");
  const [serviceAreasInput, setServiceAreasInput] = useState(
    initialVendor.service_areas?.join(", ") || ""
  );
  const [termsAccepted, setTermsAccepted] = useState(
    Boolean(initialVendor.terms_accepted_at)
  );
  const [complianceAck, setComplianceAck] = useState(
    Boolean(initialVendor.compliance_acknowledged_at)
  );

  const steps = [
    { key: "type", label: "Vendor Type" },
    { key: "details", label: "Business Details" },
    { key: "location", label: "Location" },
    { key: "compliance", label: "Compliance" },
    { key: "complete", label: "Complete" },
  ];

  useEffect(() => {
    if (initialized) return;
    const storedStep = initialVendor.vendor_onboarding_step ?? 0;
    setCurrentStep(Math.min(storedStep, steps.length - 1));
    setInitialized(true);
  }, [initialized, initialVendor.vendor_onboarding_step, steps.length]);

  useEffect(() => {
    if (currentStep > steps.length - 1) {
      setCurrentStep(steps.length - 1);
    }
  }, [currentStep, steps.length]);

  useEffect(() => {
    setAnimateIn(false);
    const timer = setTimeout(() => setAnimateIn(true), 20);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const validateStep = (stepKey: string) => {
    if (stepKey === "type" && !vendorType) {
      return "Please choose a vendor type.";
    }
    if (stepKey === "details" && !businessName.trim()) {
      return "Business name is required.";
    }
    if (stepKey === "location" && !stateValue.trim()) {
      return "State is required.";
    }
    if (stepKey === "compliance" && (!termsAccepted || !complianceAck)) {
      return "You must accept the terms and compliance requirements.";
    }
    return null;
  };

  const saveProgress = async (nextStep: number, completed: boolean) => {
    const serviceAreas = serviceAreasInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const { error: updateError } = await supabase
      .from("vendors")
      .update({
        vendor_type: vendorType || null,
        business_name: businessName || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        website: website || null,
        state: stateValue || null,
        city: city || null,
        service_areas: serviceAreas.length > 0 ? serviceAreas : null,
        terms_accepted_at: termsAccepted ? new Date().toISOString() : null,
        compliance_acknowledged_at: complianceAck ? new Date().toISOString() : null,
        vendor_onboarding_step: nextStep,
        vendor_onboarding_completed: completed,
        vendor_onboarding_completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", initialVendor.id);

    if (updateError) {
      throw updateError;
    }
  };

  const handleNext = async () => {
    setError(null);
    const stepKey = steps[currentStep]?.key;
    const validationError = validateStep(stepKey);
    if (validationError) {
      setError(validationError);
      return;
    }

    const isFinalStep = currentStep === steps.length - 1;
    const nextStepIndex = Math.min(currentStep + 1, steps.length - 1);
    const stepToPersist = isFinalStep ? steps.length - 1 : nextStepIndex;

    try {
      setSaving(true);
      await saveProgress(stepToPersist, isFinalStep);
      if (isFinalStep) {
        router.replace("/vendors/dashboard");
      } else {
        setCurrentStep(nextStepIndex);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save progress.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100);
  const stepKey = steps[currentStep]?.key;
  const showDebug =
    process.env.NODE_ENV === "development" || searchParams?.get("debug") === "1";

  const approvalState =
    initialVendor.is_approved || initialVendor.status === "active" ? "Approved" : "Pending review";

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-accent">Vendor onboarding</h1>
        <p className="text-muted mt-2">
          Complete your vendor profile to unlock vendor tools and listings.
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-muted mb-2">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{progressPercent}% complete</span>
        </div>
        <div className="h-2 bg-[var(--surface)] rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="card-glass p-4 mb-4 border border-red-500/40 text-red-300">
          {error}
        </div>
      )}

      <div
        className={[
          "card-glass p-6 transition-all duration-300",
          animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        ].join(" ")}
      >
        {stepKey === "type" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Choose your vendor type</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {VENDOR_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setVendorType(type.value)}
                  className={[
                    "p-4 rounded-lg border text-left transition-all",
                    vendorType === type.value
                      ? "border-accent bg-[rgba(95,255,215,0.08)]"
                      : "border-[var(--border)]",
                  ].join(" ")}
                >
                  <p className="text-lg font-semibold">{type.label}</p>
                  <p className="text-sm text-muted mt-1">{type.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {stepKey === "details" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Business details</h2>
            <div>
              <label className="block text-sm text-muted mb-2">Business name *</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                placeholder="Your business name"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-muted mb-2">Contact email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                  placeholder="name@business.com"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">Contact phone</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">Website (optional)</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                placeholder="https://"
              />
            </div>
          </div>
        )}

        {stepKey === "location" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Location & service area</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-muted mb-2">State *</label>
                <input
                  type="text"
                  value={stateValue}
                  onChange={(e) => setStateValue(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                  placeholder="State"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">City (optional)</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                  placeholder="City"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">Service areas (comma separated)</label>
              <input
                type="text"
                value={serviceAreasInput}
                onChange={(e) => setServiceAreasInput(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                placeholder="e.g. Denver, Boulder, Fort Collins"
              />
            </div>
          </div>
        )}

        {stepKey === "compliance" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Compliance & terms</h2>
            <p className="text-muted text-sm">
              Confirm you understand and agree to our compliance requirements.
            </p>
            <label className="flex items-start gap-3 p-3 border border-[var(--border)] rounded-lg">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={() => setTermsAccepted((prev) => !prev)}
              />
              <span>I accept the vendor terms of service.</span>
            </label>
            <label className="flex items-start gap-3 p-3 border border-[var(--border)] rounded-lg">
              <input
                type="checkbox"
                checked={complianceAck}
                onChange={() => setComplianceAck((prev) => !prev)}
              />
              <span>I acknowledge compliance requirements for hemp products.</span>
            </label>
          </div>
        )}

        {stepKey === "complete" && (
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-semibold text-accent">All set!</h2>
            <p className="text-muted">
              Your vendor onboarding is complete. Next step: {approvalState}.
            </p>
            {!initialVendor.is_approved && (
              <div className="card-glass p-4 border border-yellow-600/40 text-yellow-300 text-sm">
                We will review your submission and notify you when approval is complete.
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0 || saving}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="btn-primary px-6 py-2"
          >
            {currentStep === steps.length - 1 ? "Finish" : "Continue"}
          </button>
        </div>
      </div>

      {showDebug && (
        <details className="mt-6 text-xs text-muted">
          <summary className="cursor-pointer text-sm text-accent">Debug</summary>
          <pre className="mt-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 overflow-auto">
            {JSON.stringify(
              {
                currentStep,
                vendorType,
                businessName,
                contactEmail,
                contactPhone,
                website,
                state: stateValue,
                city,
                serviceAreas: serviceAreasInput,
                termsAccepted,
                complianceAck,
                onboardingStep: initialVendor.vendor_onboarding_step,
                onboardingCompleted: initialVendor.vendor_onboarding_completed,
                isApproved: initialVendor.is_approved,
                isActive: initialVendor.is_active,
              },
              null,
              2
            )}
          </pre>
        </details>
      )}
    </div>
  );
}
