"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { brand } from "@/lib/brand";
import JaxWelcomeHero from "@/components/mascot/JaxWelcomeHero";
import { Reveal, HoverLift, HERO_DELAYS } from "@/components/motion";

type WelcomeClientProps = {
  /** When provided (from server), mascot shows only when both NEXT_PUBLIC_MASCOT_ENABLED and MASCOT_AI_ENABLED are true */
  mascotEnabled?: boolean;
};

export default function WelcomeClient({ mascotEnabled: serverMascotEnabled }: WelcomeClientProps = {}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mascotEnabled =
    typeof serverMascotEnabled === "boolean"
      ? serverMascotEnabled
      : process.env.NEXT_PUBLIC_MASCOT_ENABLED === "true";

  if (!mounted) {
    return (
      <div className="max-w-2xl w-full mx-auto animate-fade-in opacity-0">
        <span className="sr-only" aria-live="polite">Loading…</span>
        <div className="h-24" aria-hidden="true" />
        <div className="h-64 rounded-xl bg-[var(--surface)]/40" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col">
      {mascotEnabled && (
        <Reveal delay={HERO_DELAYS.title} className="flex-shrink-0">
          <section aria-label="JAX mascot greeting">
            <JaxWelcomeHero selectedCount={0} />
          </section>
        </Reveal>
      )}

      <Reveal delay={HERO_DELAYS.title} className={`flex-shrink-0 ${mascotEnabled ? "mt-8" : ""}`}>
        <div className="flex justify-center mb-8">
          <Image
            src={brand.logoPath}
            alt={brand.logoAlt}
            width={140}
            height={94}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="hero-title text-accent mb-3">
          Welcome to {brand.name}
        </h1>
      </Reveal>
      <Reveal delay={HERO_DELAYS.subtitle}>
        <p className="hero-subtitle mb-10">
          {brand.tagline}
        </p>
      </Reveal>

      <Reveal delay={HERO_DELAYS.ctaRow} className="flex flex-wrap gap-3">
        <HoverLift as="span">
          <Link href="/" className="btn-primary motion-medium inline-block">
            Start here
          </Link>
        </HoverLift>
      </Reveal>

      <Reveal delay={HERO_DELAYS.secondary}>
        <p className="text-muted text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </Reveal>
    </div>
  );
}
