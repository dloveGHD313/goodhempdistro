"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function LoadingFallback() {
  return (
    <main style={{ padding: 32, maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>Processing Order...</h1>
      <div style={{ 
        display: "inline-block", 
        width: 32, 
        height: 32, 
        border: "3px solid #e5e7eb", 
        borderTop: "3px solid #0066cc",
        borderRadius: "50%",
        animation: "spin 1s linear infinite"
      }} />
    </main>
  );
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");
  
  const [status, setStatus] = useState<"loading" | "success" | "error" | "duplicate">("loading");
  const [orderDetails, setOrderDetails] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    // Check if this session has already been processed
    const processedKey = `order_processed_${sessionId}`;
    const alreadyProcessed = sessionStorage.getItem(processedKey);

    if (alreadyProcessed) {
      console.log("✅ Order already processed, skipping duplicate");
      setStatus("duplicate");
      setOrderDetails(JSON.parse(alreadyProcessed));
      return;
    }

    // Process the order confirmation
    processOrder(sessionId);
  }, [sessionId]);

  async function processOrder(sessionId: string) {
    try {
      // Call API to confirm order and fetch details
      const response = await fetch(`/api/orders/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to confirm order");
      }

      const data = await response.json();
      
      // Mark as processed in sessionStorage to prevent duplicates
      const processedKey = `order_processed_${sessionId}`;
      sessionStorage.setItem(processedKey, JSON.stringify(data));

      setOrderDetails(data);
      setStatus("success");
      
      console.log("✅ Order confirmed successfully:", data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Error confirming order:", errorMessage);
      setStatus("error");
    }
  }

  if (!sessionId) {
    return (
      <main style={{ padding: 32, maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 32, marginBottom: 16 }}>Invalid Order</h1>
        <p style={{ opacity: 0.8, marginBottom: 24 }}>
          No order session found.
        </p>
        <Link href="/products">← Back to Products</Link>
      </main>
    );
  }

  if (status === "loading") {
    return <LoadingFallback />;
  }

  if (status === "error") {
    return (
      <main style={{ padding: 32, maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 32, marginBottom: 16, color: "#c33" }}>Order Failed</h1>
        <p style={{ opacity: 0.8, marginBottom: 24 }}>
          There was an error processing your order. Please contact support.
        </p>
        <Link href="/products">← Back to Products</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 32, maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
      <div style={{ 
        fontSize: 48, 
        marginBottom: 16,
        color: "#22c55e"
      }}>
        ✓
      </div>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Order Confirmed!</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Thank you for your purchase. Your order has been confirmed.
      </p>

      {orderDetails && (
        <div style={{ 
          textAlign: "left", 
          border: "1px solid #e5e7eb", 
          borderRadius: 8, 
          padding: 16,
          marginBottom: 24 
        }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Order Details</h2>
          <div style={{ opacity: 0.8, lineHeight: 1.6 }}>
            <div><strong>Order ID:</strong> {(orderDetails.orderId as string) || "N/A"}</div>
            <div><strong>Session ID:</strong> {sessionId}</div>
            <div><strong>Status:</strong> {(orderDetails.status as string) || "Paid"}</div>
          </div>
        </div>
      )}

      {status === "duplicate" && (
        <div style={{ 
          padding: 12, 
          background: "#fef3c7", 
          border: "1px solid #fbbf24",
          borderRadius: 8,
          marginBottom: 24,
          fontSize: 14
        }}>
          ℹ️ This order has already been processed.
        </div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <Link href="/dashboard">View Dashboard</Link>
        <Link href="/products">Continue Shopping</Link>
      </div>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OrderSuccessContent />
    </Suspense>
  );
}
