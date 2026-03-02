"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useSafeReducedMotion } from "@/lib/useSafeReducedMotion";

const CEO_GREETING =
  "Welcome. I'm JAX — your guide to the hemp ecosystem. Choose your path and let's build something real.";

/**
 * Phase 0 entry-page JAX greeting.
 * Shows the CEO-specified intro line with a cinematic entrance animation.
 * Always renders for the entry experience (AI assistant gating is separate).
 */
export default function JaxEntryGreeting() {
  const reducedMotion = useSafeReducedMotion();

  return (
    <motion.section
      aria-label="JAX mascot greeting"
      className="flex flex-col items-center gap-3 mb-8"
      initial={reducedMotion ? undefined : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: reducedMotion ? 0.1 : 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div
        className="hero-mascot-halo relative w-[140px] sm:w-[160px] md:w-[180px] h-[140px] sm:h-[160px] md:h-[180px] flex-shrink-0"
        aria-hidden="true"
      >
        <Image
          src="/assets/jax/jax-hero.webp"
          alt="JAX — Good Hemp Distro guide"
          width={180}
          height={180}
          sizes="(max-width: 640px) 140px, (max-width: 768px) 160px, 180px"
          quality={95}
          className="object-contain w-full h-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          priority
        />
      </div>

      <motion.p
        className="text-white text-lg md:text-xl max-w-sm text-center px-4"
        initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reducedMotion ? 0.1 : 0.5,
          delay: reducedMotion ? 0 : 0.2,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {CEO_GREETING}
      </motion.p>
    </motion.section>
  );
}
