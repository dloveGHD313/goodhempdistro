"use client";

import Link from "next/link";
import { useState } from "react";
import Footer from "@/components/Footer";
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

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert: true });
    if (error) return null;
    return path;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!licenseFront || !licenseBack || !insurance || !registration) return setErrorMsg("Please upload all required documents.");
    if (!hasLicense || !is21 || !canPassBg) return setErrorMsg("Please confirm all eligibility requirements.");
    try {
      setStatus("uploading");
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      const ts = Date.now();
      const prefix = userId ? `${userId}/${ts}` : `anon/${ts}`;
      const [frontPath, backPath, insurancePath, registrationPath] = await Promise.all([
        uploadFile(licenseFront, `${prefix}/license-front.${licenseFront.name.split(".").pop() ?? "pdf"}`),
        uploadFile(licenseBack, `${prefix}/license-back.${licenseBack.name.split(".").pop() ?? "pdf"}`),
        uploadFile(insurance, `${prefix}/insurance.${insurance.name.split(".").pop() ?? "pdf"}`),
        uploadFile(registration, `${prefix}/registration.${registration.name.split(".").pop() ?? "pdf"}`),
      ]);
      if (!frontPath || !backPath || !insurancePath || !registrationPath) throw new Error("One or more document uploads failed. Please retry.");

      setStatus("submitting");
      const { error } = await supabase.from("driver_applications").insert({
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
        why_drive: whyDrive || null,
        license_front_path: frontPath,
        license_back_path: backPath,
        insurance_path: insurancePath,
        registration_path: registrationPath,
        user_id: userId,
      });
      if (error) throw new Error(error.message);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Submission failed. Please try again.");
    }
  }

  if (status === "success") return <div className="min-h-screen text-white flex flex-col"><main className="flex-1 section-shell"><div className="max-w-2xl mx-auto text-center py-20"><p className="text-4xl mb-4">🚗</p><h2 className="text-2xl font-semibold text-accent mb-3">Application submitted!</h2><p className="text-muted max-w-md mx-auto mb-6">Thank you for applying to drive with Good Hemp Distro. Our team will review your application and documents within 3-5 business days.</p><Link href="/" className="btn-primary inline-block">Back to Home →</Link></div></main><Footer /></div>;

  return <div className="min-h-screen text-white flex flex-col"><main className="flex-1 section-shell"><div className="max-w-2xl mx-auto"><h1 className="hero-title text-accent mb-2">Become a GHD Driver</h1><p className="text-muted mb-6">Join our delivery network with flexible hours and competitive pay.</p>{errorMsg && <div className="p-3 rounded bg-red-500/20 text-red-200 text-sm mb-5">{errorMsg}</div>}<form onSubmit={handleSubmit} className="space-y-4"><input required className="input-shell w-full" placeholder="Full Name" value={fullName} onChange={(e)=>setFullName(e.target.value)} /><input required type="email" className="input-shell w-full" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} /><input required type="tel" className="input-shell w-full" placeholder="Phone" value={phone} onChange={(e)=>setPhone(e.target.value)} /><div className="grid grid-cols-2 gap-3"><input required className="input-shell w-full" placeholder="City" value={city} onChange={(e)=>setCity(e.target.value)} /><input required className="input-shell w-full" placeholder="State" maxLength={2} value={stateField} onChange={(e)=>setStateField(e.target.value.toUpperCase())} /></div><select required className="input-shell w-full" value={vehicleType} onChange={(e)=>setVehicleType(e.target.value)}><option value="">Vehicle Type</option>{VEHICLE_TYPES.map((v)=><option key={v} value={v}>{v}</option>)}</select><select required className="input-shell w-full" value={yearsExp} onChange={(e)=>setYearsExp(e.target.value)}><option value="">Years of Experience</option>{EXPERIENCE_OPTIONS.map((v)=><option key={v} value={v}>{v}</option>)}</select>
  <input type="file" required accept="image/*,.pdf" onChange={(e)=>setLicenseFront(e.target.files?.[0] ?? null)} className="input-shell w-full" />
  <input type="file" required accept="image/*,.pdf" onChange={(e)=>setLicenseBack(e.target.files?.[0] ?? null)} className="input-shell w-full" />
  <input type="file" required accept=".pdf" onChange={(e)=>setInsurance(e.target.files?.[0] ?? null)} className="input-shell w-full" />
  <input type="file" required accept=".pdf" onChange={(e)=>setRegistration(e.target.files?.[0] ?? null)} className="input-shell w-full" />
  <label className="flex gap-2"><input type="checkbox" checked={hasLicense} onChange={(e)=>setHasLicense(e.target.checked)} />Valid driver's license</label><label className="flex gap-2"><input type="checkbox" checked={is21} onChange={(e)=>setIs21(e.target.checked)} />I am 21 or older</label><label className="flex gap-2"><input type="checkbox" checked={canPassBg} onChange={(e)=>setCanPassBg(e.target.checked)} />Can pass background check</label>
  <textarea className="input-shell w-full" rows={4} placeholder="Why do you want to drive for GHD? (optional)" value={whyDrive} onChange={(e)=>setWhyDrive(e.target.value)} />
  <button type="submit" disabled={status==="uploading"||status==="submitting"} className="btn-primary w-full">{status==="uploading"?"Uploading documents...":status==="submitting"?"Submitting application...":"Submit Application"}</button></form></div></main><Footer /></div>;
}
