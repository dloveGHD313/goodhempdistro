import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase";
import DeliveryRequestForm from "./DeliveryRequestForm";

export const metadata: Metadata = { title: "Request Delivery | GoodHempDistro" };

export default async function DeliveryRequestPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("driver_applications")
    .select("id, full_name, phone, email")
    .eq("status", "approved")
    .limit(10);

  return (
    <main className="min-h-screen bg-[#0D1512] px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-serif text-[#F0EDE6] mb-3">Request Delivery</h1>
        <p className="text-[#8A9E96] mb-8">Submit your delivery details and we&apos;ll match you with an approved driver.</p>
        <DeliveryRequestForm drivers={data || []} />
      </div>
    </main>
  );
}
