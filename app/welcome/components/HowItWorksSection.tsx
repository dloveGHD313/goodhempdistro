"use client";

import { useMemo, useState } from "react";
import SectionReveal from "./SectionReveal";

const consumerSteps = [
  {
    title: "Browse verified vendors near you",
    body: "Search by location, product type, and COA verification status.",
  },
  {
    title: "Review lab results",
    body: "Every product includes a Certificate of Analysis. No COA = no listing.",
  },
  {
    title: "Order with confidence",
    body: "Direct from verified vendors. Compliant products only.",
  },
];

const vendorSteps = [
  {
    title: "Register your business",
    body: "Create your vendor profile and verify your business credentials.",
  },
  {
    title: "List products + upload COAs",
    body: "Every product requires a full-panel COA before going live.",
  },
  {
    title: "Reach buyers",
    body: "Connect with wholesale buyers, retailers, and direct consumers.",
  },
];

export default function HowItWorksSection() {
  const [audience, setAudience] = useState<"consumers" | "vendors">("consumers");
  const steps = useMemo(() => (audience === "consumers" ? consumerSteps : vendorSteps), [audience]);

  return (
    <section className="px-6 py-20 bg-[#141F1A]">
      <SectionReveal>
        <div className="max-w-6xl mx-auto">
          <p className="text-xs uppercase tracking-[0.3em] text-[#3CB97A] mb-3">HOW IT WORKS</p>
          <h2 className="text-4xl text-[#F0EDE6] mb-8 font-serif">Simple. Compliant. Built for hemp.</h2>

          <div className="inline-flex border border-white/10 rounded-full p-1 mb-8">
            <button
              type="button"
              onClick={() => setAudience("consumers")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition ${audience === "consumers" ? "bg-[#3CB97A] text-[#0D1512]" : "text-[#8A9E96]"}`}
            >
              For Consumers
            </button>
            <button
              type="button"
              onClick={() => setAudience("vendors")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition ${audience === "vendors" ? "bg-[#3CB97A] text-[#0D1512]" : "text-[#8A9E96]"}`}
            >
              For Vendors
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {steps.map((step, index) => (
              <article key={step.title} className="relative rounded-2xl border border-white/10 bg-[#0D1512] p-6">
                <p className="text-[60px] leading-none font-serif text-[#3CB97A]/20 absolute top-3 right-4">
                  {index + 1}
                </p>
                <h3 className="text-[#F0EDE6] font-semibold mb-3 pr-10">{step.title}</h3>
                <p className="text-sm text-[#8A9E96]">{step.body}</p>
                {index < steps.length - 1 ? (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 border-t border-dashed border-[rgba(60,185,122,0.25)]" />
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}
