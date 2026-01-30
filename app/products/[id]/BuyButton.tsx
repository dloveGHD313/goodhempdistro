"use client";

import { useState } from "react";

type BuyButtonProps = {
  productId: string;
  maxQuantity?: number;
  disabled?: boolean;
  disabledMessage?: string | null;
};

export default function BuyButton({
  productId,
  maxQuantity = 20,
  disabled = false,
  disabledMessage = null,
}: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const updateQuantity = (next: number) => {
    const safeValue = Math.min(Math.max(next, 1), maxQuantity);
    setQuantity(safeValue);
  };

  const handleBuy = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!Number.isFinite(quantity) || quantity < 1) {
        setError("Please select a valid quantity.");
        setLoading(false);
        return;
      }
      const response = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Failed to create checkout session");
        setLoading(false);
        return;
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("No checkout URL received");
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}
      {disabled && disabledMessage && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 text-yellow-300 text-sm">
          {disabledMessage}
        </div>
      )}
      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-sm text-muted">
          Quantity
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateQuantity(quantity - 1)}
            disabled={loading || disabled || quantity <= 1}
            className="btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            -
          </button>
          <input
            id="quantity"
            type="number"
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={(event) => updateQuantity(Number(event.target.value))}
            className="w-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-white text-center"
          />
          <button
            type="button"
            onClick={() => updateQuantity(quantity + 1)}
            disabled={loading || disabled || quantity >= maxQuantity}
            className="btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>
      <button
        onClick={handleBuy}
        disabled={loading || disabled}
        className="w-full btn-primary py-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Processing..." : "Buy Now"}
      </button>
    </div>
  );
}
