"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Vendor = {
  id: string;
  owner_user_id: string;
  tier: 'starter' | 'mid' | 'top' | null;
  vendor_type: string | null;
  vendor_types: string[] | null;
  business_name: string;
};

type Props = {
  initialVendor: Vendor;
};

const VENDOR_TYPE_OPTIONS = [
  { value: 'cbd', label: 'CBD Products' },
  { value: 'hemp', label: 'Hemp Products' },
  { value: 'flower', label: 'Flower/Pre-rolls' },
  { value: 'concentrates', label: 'Concentrates' },
  { value: 'edibles', label: 'Edibles' },
  { value: 'topicals', label: 'Topicals' },
  { value: 'industrial', label: 'Industrial Materials' },
  { value: 'textiles', label: 'Textiles/Apparel' },
  { value: 'equipment', label: 'Equipment/Tools' },
  { value: 'services', label: 'Services' },
];

export default function SettingsClient({ initialVendor }: Props) {
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor>(initialVendor);
  const [tier, setTier] = useState<'starter' | 'mid' | 'top'>(initialVendor.tier || 'starter');
  const [vendorType, setVendorType] = useState<string>(initialVendor.vendor_type || '');
  const [vendorTypes, setVendorTypes] = useState<string[]>(initialVendor.vendor_types || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload: any = { tier };
      
      if (tier === 'starter' || tier === 'mid') {
        if (!vendorType) {
          setError(`${tier === 'starter' ? 'Starter' : 'Mid'} tier requires exactly one vendor type`);
          setLoading(false);
          return;
        }
        payload.vendor_type = vendorType;
        payload.vendor_types = null;
      } else if (tier === 'top') {
        if (vendorTypes.length === 0) {
          setError("Top tier requires at least one vendor type");
          setLoading(false);
          return;
        }
        payload.vendor_types = vendorTypes;
        payload.vendor_type = null;
      }

      const response = await fetch("/api/vendor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update settings");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setVendor(data.vendor);
      
      // Update local state
      if (data.vendor.vendor_type) {
        setVendorType(data.vendor.vendor_type);
        setVendorTypes([]);
      } else if (data.vendor.vendor_types) {
        setVendorTypes(data.vendor.vendor_types);
        setVendorType('');
      }

      // Refresh router
      router.refresh();

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVendorTypeToggle = (value: string) => {
    if (vendorTypes.includes(value)) {
      setVendorTypes(vendorTypes.filter(vt => vt !== value));
    } else {
      setVendorTypes([...vendorTypes, value]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6 card-glass p-8">
        {error && (
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 text-green-400">
            Settings updated successfully!
          </div>
        )}

        <div>
          <label htmlFor="tier" className="block text-sm font-medium mb-2">
            Vendor Tier <span className="text-red-400">*</span>
          </label>
          <select
            id="tier"
            value={tier}
            onChange={(e) => {
              const newTier = e.target.value as 'starter' | 'mid' | 'top';
              setTier(newTier);
              // Reset vendor types when tier changes
              if (newTier !== 'top') {
                setVendorTypes([]);
              }
            }}
            required
            className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
          >
            <option value="starter">Starter (1 vendor type)</option>
            <option value="mid">Mid (1 vendor type)</option>
            <option value="top">Top (Multiple vendor types)</option>
          </select>
          <p className="text-sm text-muted mt-1">
            {tier === 'starter' || tier === 'mid' 
              ? 'Select exactly one vendor type for this tier.'
              : 'Select one or more vendor types for this tier.'}
          </p>
        </div>

        {tier === 'starter' || tier === 'mid' ? (
          <div>
            <label htmlFor="vendor_type" className="block text-sm font-medium mb-2">
              Vendor Type <span className="text-red-400">*</span>
            </label>
            <select
              id="vendor_type"
              value={vendorType}
              onChange={(e) => setVendorType(e.target.value)}
              required
              className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
            >
              <option value="">Select vendor type</option>
              {VENDOR_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-2">
              Vendor Types <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {VENDOR_TYPE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vendorTypes.includes(option.value)}
                    onChange={() => handleVendorTypeToggle(option.value)}
                    className="w-4 h-4 accent-accent"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {vendorTypes.length === 0 && (
              <p className="text-red-400 text-sm mt-2">
                Select at least one vendor type for top tier
              </p>
            )}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || (tier === 'top' && vendorTypes.length === 0)}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Save Settings"}
          </button>
          <Link href="/vendors/dashboard" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
