"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type ConsumerType = "individual" | "business";
type BusinessType =
  | "hotel"
  | "apartment"
  | "spa"
  | "office"
  | "retail"
  | "event"
  | "staff_buyers"
  | "b2b"
  | "other";
type PurchaseIntent = "bulk" | "recurring" | "one-time";
type Interest = "products" | "services" | "education" | "events";
type ExperienceLevel = "new" | "experienced";
type UseCase = "Business Supplies" | "Skincare" | "Wellness" | "General";
type MarketPreference = "CBD_WELLNESS" | "INDUSTRIAL" | "SERVICES" | "INTOXICATING" | "BROWSING";

type InitialProfile = {
  role: string | null;
  market_mode_preference: string | null;
  consumer_type: ConsumerType | null;
  business_type: BusinessType | null;
  purchase_intent: PurchaseIntent[] | null;
  interests: Interest[] | null;
  experience_level: ExperienceLevel | null;
  state: string | null;
  city: string | null;
  company_size: string | null;
  consumer_interest_tags: string[] | null;
  consumer_use_case: string | null;
  consumer_onboarding_step: number | null;
  consumer_onboarding_completed: boolean | null;
};

type Props = {
  userId: string;
  initialProfile: InitialProfile;
  initialError?: string | null;
};

const STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: "hotel", label: "Hotel" },
  { value: "apartment", label: "Apartment / Property" },
  { value: "spa", label: "Spa / Wellness" },
  { value: "office", label: "Office / Corporate" },
  { value: "retail", label: "Retail" },
  { value: "event", label: "Event / Venue" },
  { value: "staff_buyers", label: "Staff buyers / employee programs" },
  { value: "b2b", label: "B2B / wholesale" },
  { value: "other", label: "Other" },
];

const PURCHASE_INTENTS: { value: PurchaseIntent; label: string }[] = [
  { value: "bulk", label: "Bulk purchase" },
  { value: "recurring", label: "Recurring supply" },
  { value: "one-time", label: "One-time order" },
];

const INTERESTS: { value: Interest; label: string }[] = [
  { value: "products", label: "Products" },
  { value: "services", label: "Services" },
  { value: "education", label: "Education" },
  { value: "events", label: "Events" },
];

const USE_CASES: { value: UseCase; label: string; description: string }[] = [
  { value: "Business Supplies", label: "Business supplies", description: "Paper, textiles, supplies" },
  { value: "Skincare", label: "Skincare / topicals", description: "Lotions, balms, topical care" },
  { value: "Wellness", label: "Wellness", description: "Non-intoxicating wellness" },
  { value: "General", label: "I’m just browsing", description: "Show me a little of everything" },
];

const INTEREST_TAGS: { value: string; label: string }[] = [
  { value: "Business Supplies", label: "Business supplies" },
  { value: "Skincare", label: "Skincare" },
  { value: "Wellness", label: "Wellness CBD" },
  { value: "Topicals", label: "Topicals" },
  { value: "Industrial", label: "Industrial materials" },
  { value: "Services", label: "Professional services" },
  { value: "Labs", label: "Lab / COA testing" },
  { value: "Consulting", label: "Consulting" },
  { value: "General", label: "General" },
];

const MARKET_CHOICES: { value: MarketPreference; label: string; description: string }[] = [
  { value: "CBD_WELLNESS", label: "CBD & Wellness", description: "Non-intoxicating CBD essentials" },
  { value: "INDUSTRIAL", label: "Industrial", description: "Materials, fiber, and supplies" },
  { value: "SERVICES", label: "Services", description: "Legal, banking, labs, consulting" },
  { value: "BROWSING", label: "Just browsing", description: "Show a little of everything" },
];

export default function ConsumerOnboardingClient({
  userId,
  initialProfile,
  initialError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [currentStep, setCurrentStep] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [animateIn, setAnimateIn] = useState(true);

  const [stateValue, setStateValue] = useState(initialProfile.state || "");
  const [city, setCity] = useState(initialProfile.city || "");
  const [marketPreference, setMarketPreference] = useState<MarketPreference>(
    (initialProfile.market_mode_preference as MarketPreference) || "CBD_WELLNESS"
  );
  const [consumerType, setConsumerType] = useState<ConsumerType | "">(
    initialProfile.consumer_type || ""
  );
  const [businessType, setBusinessType] = useState<BusinessType | "">(
    initialProfile.business_type || ""
  );
  const [purchaseIntent, setPurchaseIntent] = useState<PurchaseIntent[]>(
    initialProfile.purchase_intent || []
  );
  const [companySize, setCompanySize] = useState(initialProfile.company_size || "");
  const [interests, setInterests] = useState<Interest[]>(
    initialProfile.interests || []
  );
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | "">(
    initialProfile.experience_level || ""
  );
  const [useCase, setUseCase] = useState<UseCase | "">(
    (initialProfile.consumer_use_case as UseCase | null) || ""
  );
  const [interestTags, setInterestTags] = useState<string[]>(
    initialProfile.consumer_interest_tags || []
  );

  const steps = useMemo(() => {
    const base = [
      { key: "location", label: "Location" },
      { key: "consumer_type", label: "Consumer Type" },
    ];
    if (consumerType === "business") {
      base.push({ key: "business", label: "Business Details" });
    }
    base.push({ key: "market", label: "Market Focus" });
    base.push({ key: "use_case", label: "Shopping Goals" });
    base.push({ key: "interests", label: "Interests" });
    base.push({ key: "experience", label: "Experience" });
    return base;
  }, [consumerType]);

  useEffect(() => {
    if (initialized) return;
    const storedStep = initialProfile.consumer_onboarding_step ?? 0;
    setCurrentStep(Math.min(storedStep, steps.length - 1));
    setInitialized(true);
  }, [initialized, initialProfile.consumer_onboarding_step, steps.length]);

  useEffect(() => {
    if (currentStep > steps.length - 1) {
      setCurrentStep(steps.length - 1);
    }
  }, [currentStep, steps.length]);

  useEffect(() => {
    if (consumerType !== "business") {
      setBusinessType("");
      setPurchaseIntent([]);
      setCompanySize("");
    }
  }, [consumerType]);

  useEffect(() => {
    setAnimateIn(false);
    const timer = setTimeout(() => setAnimateIn(true), 20);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const toggleIntent = (value: PurchaseIntent) => {
    setPurchaseIntent((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const toggleInterest = (value: Interest) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const toggleInterestTag = (value: string) => {
    setInterestTags((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const validateStep = (stepKey: string) => {
    if (stepKey === "location") {
      if (!stateValue) return "Please select your state.";
    }
    if (stepKey === "consumer_type") {
      if (!consumerType) return "Please choose a consumer type.";
    }
    if (stepKey === "business") {
      if (!businessType) return "Please choose a business type.";
      if (purchaseIntent.length === 0) return "Select at least one purchase intent.";
    }
    if (stepKey === "market") {
      if (!marketPreference) return "Please select a market.";
    }
    if (stepKey === "use_case") {
      if (!useCase) return "Please select your shopping goal.";
      if (interestTags.length === 0) return "Select at least one interest tag.";
    }
    if (stepKey === "interests") {
      if (interests.length === 0) return "Select at least one interest.";
    }
    if (stepKey === "experience") {
      if (!experienceLevel) return "Please select your experience level.";
    }
    return null;
  };

  const saveProfile = async (nextStepIndex: number, completed: boolean) => {
    const payload = {
      id: userId,
      market_mode_preference: marketPreference === "BROWSING" ? "CBD_WELLNESS" : marketPreference,
      consumer_type: consumerType || null,
      business_type: consumerType === "business" ? businessType || null : null,
      purchase_intent: consumerType === "business" ? purchaseIntent : null,
      company_size: consumerType === "business" ? companySize || null : null,
      interests,
      consumer_interest_tags: interestTags,
      consumer_use_case: useCase || null,
      experience_level: experienceLevel || null,
      state: stateValue || null,
      city: city || null,
      consumer_onboarding_step: nextStepIndex,
      consumer_onboarding_completed: completed,
      consumer_onboarding_completed_at: completed ? new Date().toISOString() : null,
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

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
    // Persist the step the user will see next to resume accurately.
    const stepToPersist = isFinalStep ? steps.length - 1 : nextStepIndex;

    try {
      setSaving(true);
      await saveProfile(stepToPersist, isFinalStep);
      if (isFinalStep) {
        router.replace("/dashboard");
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

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-accent">Welcome to Good Hemp Distro</h1>
        <p className="text-muted mt-2">
          Let’s personalize your experience with a few quick questions.
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
        {stepKey === "location" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Where are you located?</h2>
            <div>
              <label className="block text-sm text-muted mb-2">State *</label>
              <select
                value={stateValue}
                onChange={(e) => setStateValue(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
              >
                <option value="">Select a state</option>
                {STATES.map((state) => (
                  <option key={state.value} value={state.value}>
                    {state.label}
                  </option>
                ))}
              </select>
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
        )}

        {stepKey === "consumer_type" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">How will you shop with us?</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(["individual", "business"] as ConsumerType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setConsumerType(type)}
                  className={[
                    "p-4 rounded-lg border text-left transition-all",
                    consumerType === type
                      ? "border-accent bg-[rgba(95,255,215,0.08)]"
                      : "border-[var(--border)]",
                  ].join(" ")}
                >
                  <p className="text-lg font-semibold">
                    {type === "individual" ? "Individual" : "Business / Organization"}
                  </p>
                  <p className="text-sm text-muted mt-1">
                    {type === "individual"
                      ? "Personal use and small orders"
                      : "Organizations, venues, and bulk needs"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {stepKey === "business" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Tell us about your business</h2>
            <div>
              <label className="block text-sm text-muted mb-2">Business type *</label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
              >
                <option value="">Select a business type</option>
                {BUSINESS_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">Purchase intent *</label>
              <div className="grid gap-2 md:grid-cols-3">
                {PURCHASE_INTENTS.map((intent) => (
                  <label
                    key={intent.value}
                    className="flex items-center gap-2 p-3 border border-[var(--border)] rounded-lg"
                  >
                    <input
                      type="checkbox"
                      checked={purchaseIntent.includes(intent.value)}
                      onChange={() => toggleIntent(intent.value)}
                    />
                    <span>{intent.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">Company size (optional)</label>
              <input
                type="text"
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                placeholder="e.g., 25 employees, 50 rooms"
              />
            </div>
          </div>
        )}

        {stepKey === "market" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Which market are you here for?</h2>
              <p className="text-sm text-muted">
                We will tailor your default browsing experience (ungated only).
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {MARKET_CHOICES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMarketPreference(option.value)}
                  className={[
                    "p-4 rounded-lg border text-left transition-all",
                    marketPreference === option.value
                      ? "border-accent bg-[rgba(95,255,215,0.08)]"
                      : "border-[var(--border)]",
                  ].join(" ")}
                >
                  <p className="text-lg font-semibold">{option.label}</p>
                  <p className="text-sm text-muted mt-1">{option.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {stepKey === "use_case" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">What are you shopping for?</h2>
              <p className="text-sm text-muted">
                This helps us tailor your browsing experience.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {USE_CASES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUseCase(option.value)}
                  className={[
                    "p-4 rounded-lg border text-left transition-all",
                    useCase === option.value
                      ? "border-accent bg-[rgba(95,255,215,0.08)]"
                      : "border-[var(--border)]",
                  ].join(" ")}
                >
                  <p className="text-lg font-semibold">{option.label}</p>
                  <p className="text-sm text-muted mt-1">{option.description}</p>
                </button>
              ))}
            </div>
            <div>
              <p className="text-sm text-muted mb-2">Pick interest tags</p>
              <div className="grid gap-2 md:grid-cols-2">
                {INTEREST_TAGS.map((tag) => (
                  <label
                    key={tag.value}
                    className="flex items-center gap-2 p-3 border border-[var(--border)] rounded-lg"
                  >
                    <input
                      type="checkbox"
                      checked={interestTags.includes(tag.value)}
                      onChange={() => toggleInterestTag(tag.value)}
                    />
                    <span>{tag.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {stepKey === "interests" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">What are you most interested in?</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {INTERESTS.map((interest) => (
                <label
                  key={interest.value}
                  className="flex items-center gap-2 p-3 border border-[var(--border)] rounded-lg"
                >
                  <input
                    type="checkbox"
                    checked={interests.includes(interest.value)}
                    onChange={() => toggleInterest(interest.value)}
                  />
                  <span>{interest.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {stepKey === "experience" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">What’s your experience level?</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(["new", "experienced"] as ExperienceLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setExperienceLevel(level)}
                  className={[
                    "p-4 rounded-lg border text-left transition-all",
                    experienceLevel === level
                      ? "border-accent bg-[rgba(95,255,215,0.08)]"
                      : "border-[var(--border)]",
                  ].join(" ")}
                >
                  <p className="text-lg font-semibold">
                    {level === "new" ? "New to hemp" : "Experienced"}
                  </p>
                  <p className="text-sm text-muted mt-1">
                    {level === "new"
                      ? "I’m just getting started"
                      : "I already know what I’m looking for"}
                  </p>
                </button>
              ))}
            </div>
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
                steps: steps.map((step) => step.key),
                consumerType,
                businessType,
                marketPreference,
                purchaseIntent,
                companySize,
                interests,
                consumerUseCase: useCase,
                consumerInterestTags: interestTags,
                experienceLevel,
                state: stateValue,
                city,
                onboardingStep: initialProfile.consumer_onboarding_step,
                onboardingCompleted: initialProfile.consumer_onboarding_completed,
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
