"use client";

import Link from "next/link";
import { useState } from "react";
import Footer from "@/components/Footer";

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

  // P2 (shop brief 2026-07-14): documents upload through the server API
  // with the service role. The old browser-direct storage upload failed
  // silently (upsert without an UPDATE storage policy) and its error was
  // swallowed into a generic message; the server route now validates each
  // file (PDF/JPG/PNG/WebP, 10MB) and returns specific failures.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!licenseFront || !licenseBack || !insurance || !registration) return setErrorMsg("Please upload all required documents.");
    if (!hasLicense || !is21 || !canPassBg) return setErrorMsg("Please confirm all eligibility requirements.");
    try {
      setStatus("uploading");
      const formData = new FormData();
      formData.set("full_name", fullName);
      formData.set("email", email);
      formData.set("phone", phone);
      formData.set("city", city);
      formData.set("state", stateField);
      formData.set("vehicle_type", vehicleType);
      formData.set("years_experience", yearsExp);
      formData.set("has_valid_license", String(hasLicense));
      formData.set("is_21_or_older", String(is21));
      formData.set("can_pass_background_check", String(canPassBg));
      formData.set("why_drive", whyDrive);
      formData.set("license_front", licenseFront);
      formData.set("license_back", licenseBack);
      formData.set("insurance", insurance);
      formData.set("registration", registration);

      setStatus("submitting");
      const res = await fetch("/api/drivers/apply-with-docs", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Submission failed. Please try again.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Submission failed. Please try again.");
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
  <button type="submit" disabled={status==="uploading"||status==="submitting"} className="btn-primary w-full">{status==="uploading"?"Uploading documents...":status==="submitting"?"Submitting application...":"Submit Application"}</button></form></div></main><Footer /></div>;
}
