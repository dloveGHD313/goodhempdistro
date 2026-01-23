"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import FavoriteButton from "@/components/engagement/FavoriteButton";
import ReviewSection from "@/components/engagement/ReviewSection";

type Service = {
  id: string;
  name?: string;
  title: string;
  description?: string;
  pricing_type?: string;
  price_cents?: number;
  slug?: string;
  category_id?: string;
  categories?: {
    name: string;
    slug?: string;
  } | null;
  vendors?: {
    business_name: string;
  } | null;
};

type Props = {
  service: Service;
};

export default function ServiceDetailClient({ service }: Props) {
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check if user is logged in and prefill email
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data, error }) => {
      if (data.user) {
        setIsLoggedIn(true);
        setUserEmail(data.user.email || null);
        if (data.user.email) {
          setRequesterEmail(data.user.email);
        }
      }
    });
  }, []);

  const formatPrice = (pricingType?: string, priceCents?: number) => {
    if (!pricingType || pricingType === 'quote_only') {
      return "Quote Only";
    }
    if (!priceCents) {
      return "Price TBD";
    }
    return `$${((priceCents || 0) / 100).toFixed(2)} ${pricingType === 'hourly' ? '/hr' : pricingType === 'per_project' ? '/project' : ''}`;
  };

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Client-side validation
    // Email is required only if not logged in
    if (!isLoggedIn && !requesterEmail.trim()) {
      setError("Email is required");
      setSubmitting(false);
      return;
    }

    if (requesterEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(requesterEmail.trim())) {
        setError("Invalid email address");
        setSubmitting(false);
        return;
      }
    }

    if (!message.trim()) {
      setError("Message is required");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/services/${service.id}/inquire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester_name: requesterName.trim() || null,
          requester_email: requesterEmail.trim(),
          requester_phone: requesterPhone.trim() || null,
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send inquiry");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setRequesterName("");
      setRequesterEmail("");
      setRequesterPhone("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/services" className="text-muted hover:text-accent mb-6 inline-block">
        ← Back to Services
      </Link>

      <div className="card-glass p-8 mb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-4xl font-bold mb-4 text-accent">{service.name || service.title}</h1>
          <FavoriteButton entityType="service" entityId={service.id} size="md" />
        </div>
        
        {service.vendors?.business_name && (
          <p className="text-muted mb-4">By {service.vendors.business_name}</p>
        )}

        {service.categories?.name && (
          <span className="inline-block px-3 py-1 bg-[var(--surface)] rounded text-sm mb-6">
            {service.categories.name}
          </span>
        )}

        {service.pricing_type && (
          <div className="text-2xl font-semibold text-accent mb-6">
            {formatPrice(service.pricing_type, service.price_cents)}
          </div>
        )}

        {service.description && (
          <div className="prose prose-invert max-w-none mb-8">
            <p className="text-lg text-muted whitespace-pre-line">{service.description}</p>
          </div>
        )}
      </div>

      <ReviewSection entityType="service" entityId={service.id} title="Service Reviews" />

      {/* Inquiry Form */}
      <div className="card-glass p-8">
        <h2 className="text-2xl font-bold mb-6">Request Service</h2>

        {submitted && (
          <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 mb-6">
            <p className="text-green-400">
              ✓ Your inquiry has been sent! The vendor will contact you soon.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleInquiry} className="space-y-4">
          <div>
            <label htmlFor="requester_name" className="block text-sm font-medium mb-2">
              Your Name
            </label>
            <input
              id="requester_name"
              type="text"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              disabled={submitting || submitted}
              className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white disabled:opacity-50"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label htmlFor="requester_email" className="block text-sm font-medium mb-2">
              Email {!isLoggedIn && <span className="text-red-400">*</span>}
            </label>
            <input
              id="requester_email"
              type="email"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              required={!isLoggedIn}
              disabled={submitting || submitted || isLoggedIn}
              className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white disabled:opacity-50"
              placeholder="john@example.com"
            />
            {isLoggedIn && (
              <p className="text-xs text-muted mt-1">Using your account email ({userEmail})</p>
            )}
          </div>

          <div>
            <label htmlFor="requester_phone" className="block text-sm font-medium mb-2">
              Phone
            </label>
            <input
              id="requester_phone"
              type="tel"
              value={requesterPhone}
              onChange={(e) => setRequesterPhone(e.target.value)}
              disabled={submitting || submitted}
              className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white disabled:opacity-50"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium mb-2">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
              disabled={submitting || submitted}
              className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white disabled:opacity-50"
              placeholder="Tell the vendor about your service needs..."
            />
            <p className="text-xs text-muted mt-1">Max 5000 characters</p>
          </div>

          <button
            type="submit"
            disabled={submitting || submitted}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending..." : submitted ? "Sent!" : "Request Service"}
          </button>
        </form>
      </div>
    </div>
  );
}
