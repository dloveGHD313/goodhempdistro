"use client";

import { useState } from "react";
import Link from "next/link";

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
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      const response = await fetch(`/api/services/${service.id}/inquire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inquiryName.trim(),
          email: inquiryEmail.trim(),
          message: inquiryMessage.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send inquiry");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setInquiryName("");
      setInquiryEmail("");
      setInquiryMessage("");
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
        <h1 className="text-4xl font-bold mb-4 text-accent">{service.name || service.title}</h1>
        
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

      {/* Inquiry Form */}
      <div className="card-glass p-8">
        <h2 className="text-2xl font-bold mb-6">Request a Quote</h2>

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
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Your Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={inquiryName}
              onChange={(e) => setInquiryName(e.target.value)}
              required
              disabled={submitting || submitted}
              className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={inquiryEmail}
              onChange={(e) => setInquiryEmail(e.target.value)}
              required
              disabled={submitting || submitted}
              className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium mb-2">
              Message
            </label>
            <textarea
              id="message"
              value={inquiryMessage}
              onChange={(e) => setInquiryMessage(e.target.value)}
              rows={4}
              disabled={submitting || submitted}
              className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white disabled:opacity-50"
              placeholder="Tell the vendor about your service needs..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting || submitted}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending..." : submitted ? "Sent!" : "Send Inquiry"}
          </button>
        </form>
      </div>
    </div>
  );
}
