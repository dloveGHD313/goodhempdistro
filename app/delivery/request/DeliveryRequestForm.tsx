"use client";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Driver = { id: string; full_name: string | null; phone: string | null; email: string | null };

export default function DeliveryRequestForm({ drivers }: { drivers: Driver[] }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      pickup_address: String(fd.get("pickup_address") || ""),
      delivery_address: String(fd.get("delivery_address") || ""),
      item_description: String(fd.get("item_description") || ""),
      preferred_datetime: String(fd.get("preferred_datetime") || ""),
      contact_name: String(fd.get("contact_name") || ""),
      contact_phone: String(fd.get("contact_phone") || ""),
      contact_email: String(fd.get("contact_email") || ""),
      status: "pending",
    };
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from("delivery_requests").insert(payload);
    if (insertError) setError(insertError.message);
    else setDone(true);
    setLoading(false);
  }

  if (done) return <div className="rounded-xl border border-[#3CB97A]/40 bg-[#141F1A] p-6 text-[#F0EDE6]">Request submitted — an approved driver will contact you within 2 hours.</div>

  return <form onSubmit={onSubmit} className="space-y-4 text-[#F0EDE6]">
    {error && <p className="text-red-300">{error}</p>}
    {[
      ["pickup_address","Pickup address"],["delivery_address","Delivery address"],["item_description","Item description"],["preferred_datetime","Preferred date/time (e.g. 2026-05-10 3pm)"],["contact_name","Contact name"],["contact_phone","Phone"],["contact_email","Email"]
    ].map(([name,label]) => <input key={name} required name={name} placeholder={label} className="w-full rounded-lg bg-[#1A2820] border border-white/10 px-4 py-3" />)}
    <button disabled={loading} className="px-6 py-3 rounded-lg bg-[#3CB97A] text-[#0D1512] font-semibold">{loading?"Submitting...":"Submit Request"}</button>
    <p className="text-[#8A9E96] text-sm">Estimated response time: within 2 hours.</p>
    <div className="pt-4"><h2 className="font-serif text-2xl mb-2">Approved Drivers</h2>{drivers.length===0?<p className="text-[#8A9E96]">Available driver will be assigned.</p>:<ul className="space-y-2">{drivers.map(d=><li key={d.id} className="text-sm">{d.full_name||"Approved Driver"} — {d.phone||d.email||"Available driver will be assigned"}</li>)}</ul>}</div>
  </form>
}
