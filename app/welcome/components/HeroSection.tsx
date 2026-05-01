"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function AnimatedLine({ children, delayMs = 0, className = "" }: { children: React.ReactNode; delayMs?: number; className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 25);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`transition-all duration-700 ease-out ${className} ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

export default function HeroSection() {

  useEffect(() => {
    function logTopElement(e: MouseEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      console.log('[GLOBAL-CLICK] element at point:', {
        tag: el?.tagName,
        className: (el as HTMLElement | null)?.className,
        id: (el as HTMLElement | null)?.id,
      });
    }

    window.addEventListener("click", logTopElement, true);
    return () => window.removeEventListener("click", logTopElement, true);
  }, []);

  return (
    <section
      className="relative min-h-screen flex items-center justify-center px-6 py-24"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 40%, rgba(60,185,122,0.12) 0%, transparent 70%), #0D1512",
      }}
    >
      <div className="relative z-10 max-w-5xl w-full text-center">
        <AnimatedLine delayMs={100}>
          <p className="text-xs uppercase tracking-[0.35em] text-[#3CB97A] mb-6">THE HEMP INDUSTRY PLATFORM</p>
        </AnimatedLine>

        <AnimatedLine delayMs={250}>
          <h1 className="text-[#F0EDE6] text-5xl md:text-7xl leading-tight mb-6 font-serif">
            Every Vendor.<br />
            Every Product.<br />
            One Platform.
          </h1>
        </AnimatedLine>

        <AnimatedLine delayMs={400}>
          <p className="text-[#8A9E96] text-lg max-w-2xl mx-auto mb-10">
            Discover verified hemp vendors, shop compliant products, and grow your business — all in one place.
          </p>
        </AnimatedLine>

        <AnimatedLine delayMs={550}>
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link
              href="/products"
              className="px-7 py-3 rounded-xl font-semibold text-[#0D1512] bg-[#3CB97A] border border-[#3CB97A] hover:scale-[1.02] transition-all duration-200"
              onClick={(e) => {
                console.log('[CTA-CLICK] Shop Hemp Products clicked', {
                  target: e.target,
                  currentTarget: e.currentTarget,
                  defaultPrevented: e.defaultPrevented,
                  bubbles: e.bubbles,
                });
              }}
            >
              Shop Hemp Products →
            </Link>
            <Link
              href="/vendor-registration"
              className="px-7 py-3 rounded-xl font-semibold text-[#3CB97A] border border-[#3CB97A] hover:bg-[#1A2820] hover:scale-[1.02] transition-all duration-200"
              onClick={(e) => {
                console.log('[CTA-CLICK] Become a Vendor clicked', {
                  target: e.target,
                  currentTarget: e.currentTarget,
                  defaultPrevented: e.defaultPrevented,
                  bubbles: e.bubbles,
                });
              }}
            >
              Become a Vendor →
            </Link>
          </div>
        </AnimatedLine>

        <AnimatedLine delayMs={700}>
          <div className="flex flex-wrap justify-center gap-3 md:gap-8 text-sm text-[#4A5E57]">
            <span>✓ 120+ Verified Vendors</span>
            <span>✓ COA-Certified Products</span>
            <span>✓ Nashville, TN + Nationwide</span>
          </div>
        </AnimatedLine>
      </div>
    </section>
  );
}
