"use client";

import Link from "next/link";
import { useState } from "react";
import Footer from "@/components/Footer";
import TurnstileWidget from "@/components/TurnstileWidget";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const VEHICLE_TYPES = ["Sedan", "SUV", "Pickup Truck", "Cargo Van", "Box Truck", "Motorcycle"];
const EXPERIENCE_OPTIONS = ["Less than 1 year", "1-2 years", "3-5 years", "5+ years"];
type FormState = "idle" | "uploading" | "submitting" | "success" | "error";

export default function DriverApplicationPage() {
  const [status, setStatus] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [hasLicense, setHasLicense] = useState(false);
  const [is21, setIs21] = useState(false);
  const [canPassBg, setCanPassBg] = useState(false);
  const [whyDrive, setWhyDrive] = useState("");
  const [licenseFront, setLicenseFront] = useState<File | null>(null);
  const [licenseBack, setLicenseBack] = useState<File | null>(null);
  const [insurance, setInsurance] = useState<File | null>(null);
  const [registration, setRegistration] = useState<File | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // 2026-07-14 follow-up to #214: file bytes must NOT flow through a
  // Vercel function — the platform rejects request bodies over 4.5MB at
  // the edge (413, zero runtime logs), and four phone photos exceed that
  // immediately. Flow is now: /init issues signed upload URLs (small
  // JSON) → browser uploads each file DIRECTLY to Supabase Storage →
  // /finalize verifies the files landed and records the application.
  // Every stage sets a specific visible message and logs the raw error.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const fail = (stage: string, message: string, raw?: unknown) => {
      console.error(`[driver-apply] ${stage} failed:`, raw ?? message);
      setStatus("error");
      setErrorMsg(message);
    };
    const docFiles = {
      license_front: licenseFront,
      license_back: licenseBack,
      insurance,
      registration,
    } as const;
    const missingDocs = Object.entries(docFiles)
      .filter(([, file]) => !file)
      .map(([key]) => key.replace(/_/g, " "));
    if (missingDocs.length > 0) {
      return fail("validation", `Please attach: ${missingDocs.join(", ")}.`);
    }
    if (!hasLicense || !is21 || !canPassBg) {
      return fail("validation", "Please confirm all three eligibility checkboxes.");
    }
    try {
      setStatus("uploading");

      // Stage 1: get signed upload URLs (validates type/size server-side).
      const initRes = await fetch("/api/drivers/apply/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnstileToken,
          docs: Object.entries(docFiles).map(([doc_type, file]) => ({
            doc_type,
            mime: file!.type,
            size: file!.size,
          })),
        }),
      });
      const initData = await initRes.json().catch(() => null);
      if (!initRes.ok) {
        return fail(
          "init",
          initData?.error || `Could not start the upload (HTTP ${initRes.status}).`,
          initData
        );
      }

      // Stage 2: upload each file directly to storage via its signed URL.
      const supabase = createSupabaseBrowserClient();
      for (const [docType, file] of Object.entries(docFiles)) {
        const target = initData?.uploads?.[docType];
        if (!target?.path || !target?.token) {
          return fail("upload", `Upload target missing for ${docType.replace(/_/g, " ")}. Please retry.`, initData);
        }
        const { error } = await supabase.storage
          .from(initData.bucket || "driver-documents")
          .uploadToSignedUrl(target.path, target.token, file!, {
            contentType: file!.type || "application/octet-stream",
          });
        if (error) {
          return fail(
            "upload",
            `Uploading your ${docType.replace(/_/g, " ")} failed: ${error.message}. Please retry.`,
            error
          );
        }
      }

      // Stage 3: record the application against the uploaded paths.
      setStatus("submitting");
      const finalizeRes = await fetch("/api/drivers/apply/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_id: initData.upload_id,
          paths: Object.fromEntries(
            Object.keys(docFiles).map((docType) => [docType, initData.uploads[docType].path])
          ),
          full_name: fullName,
          email,
          phone,
          city,
          state: stateField,
          vehicle_type: vehicleType,
          years_experience: yearsExp,
          has_valid_license: hasLicense,
          is_21_or_older: is21,
          can_pass_background_check: canPassBg,
          why_drive: whyDrive,
        }),
      });
      const finalizeData = await finalizeRes.json().catch(() => null);
      if (!finalizeRes.ok) {
        return fail(
          "finalize",
          finalizeData?.error || `Could not save the application (HTTP ${finalizeRes.status}).`,
          finalizeData
        );
      }
      setStatus("success");
    } catch (err) {
      fail(
        "network",
        err instanceof Error
          ? `Network error: ${err.message}. Check your connection and retry.`
          : "Unexpected error. Please try again.",
        err
      );
    }
  }

  if (status === "success") return <div className="min-h-screen text-white flex flex-col"><main className="flex-1 section-shell"><div className="max-w-2xl mx-auto text-center py-20"><p className="text-4xl mb-4">🚗</p><h2 className="text-2xl font-semibold text-accent mb-3">Application submitted!</h2><p className="text-muted max-w-md mx-auto mb-6">Thank you for applying to drive with Good Hemp Distro. Our team will review your application and documents within 3-5 business days.</p><Link href="/" className="btn-primary inline-block">Back to Home →</Link></div></main><Footer /></div>;

  return <div className="min-h-screen text-white flex flex-col"><main className="flex-1 section-shell"><div className="max-w-2xl mx-auto"><h1 className="hero-title text-accent mb-2">Become a GHD Driver</h1><p className="text-muted mb-6">Join our delivery network with flexible hours and competitive pay.</p>{errorMsg && <div className="p-3 rounded bg-red-500/20 text-red-200 text-sm mb-5">{errorMsg}</div>}<form onSubmit={handleSubmit} className="space-y-4"><input required className="input-shell w-full" placeholder="Full Name" value={fullName} onChange={(e)=>setFullName(e.target.value)} /><input required type="email" className="input-shell w-full" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} /><input required type="tel" className="input-shell w-full" placeholder="Phone" value={phone} onChange={(e)=>setPhone(e.target.value)} /><div className="grid grid-cols-2 gap-3"><input required className="input-shell w-full" placeholder="City" value={city} onChange={(e)=>setCity(e.target.value)} /><input required className="input-shell w-full" placeholder="State" maxLength={2} value={stateField} onChange={(e)=>setStateField(e.target.value.toUpperCase())} /></div><select required className="input-shell w-full" value={vehicleType} onChange={(e)=>setVehicleType(e.target.value)}><option value="">Vehicle Type</option>{VEHICLE_TYPES.map((v)=><option key={v} value={v}>{v}</option>)}</select><select required className="input-shell w-full" value={yearsExp} onChange={(e)=>setYearsExp(e.target.value)}><option value="">Years of Experience</option>{EXPERIENCE_OPTIONS.map((v)=><option key={v} value={v}>{v}</option>)}</select>
  <label className="block text-sm text-muted">Driver&apos;s license (front) — PDF, JPG, or PNG<input type="file" required accept="image/jpeg,image/png,image/webp,.pdf" onChange={(e)=>setLicenseFront(e.target.files?.[0] ?? null)} className="input-shell w-full mt-1" /></label>
  <label className="block text-sm text-muted">Driver&apos;s license (back) — PDF, JPG, or PNG<input type="file" required accept="image/jpeg,image/png,image/webp,.pdf" onChange={(e)=>setLicenseBack(e.target.files?.[0] ?? null)} className="input-shell w-full mt-1" /></label>
  <label className="block text-sm text-muted">Proof of insurance — PDF, JPG, or PNG<input type="file" required accept="image/jpeg,image/png,image/webp,.pdf" onChange={(e)=>setInsurance(e.target.files?.[0] ?? null)} className="input-shell w-full mt-1" /></label>
  <label className="block text-sm text-muted">Vehicle registration — PDF, JPG, or PNG<input type="file" required accept="image/jpeg,image/png,image/webp,.pdf" onChange={(e)=>setRegistration(e.target.files?.[0] ?? null)} className="input-shell w-full mt-1" /></label>
  <label className="flex gap-2"><input type="checkbox" checked={hasLicense} onChange={(e)=>setHasLicense(e.target.checked)} />Valid driver's license</label><label className="flex gap-2"><input type="checkbox" checked={is21} onChange={(e)=>setIs21(e.target.checked)} />I am 21 or older</label><label className="flex gap-2"><input type="checkbox" checked={canPassBg} onChange={(e)=>setCanPassBg(e.target.checked)} />Can pass background check</label>
  <textarea className="input-shell w-full" rows={4} placeholder="Why do you want to drive for GHD? (optional)" value={whyDrive} onChange={(e)=>setWhyDrive(e.target.value)} />
  <TurnstileWidget action="driver_application" onToken={setTurnstileToken} />
  <button type="submit" disabled={status==="uploading"||status==="submitting"} className="btn-primary w-full">{status==="uploading"?"Uploading documents...":status==="submitting"?"Submitting application...":"Submit Application"}</button></form></div></main><Footer /></div>;
}
