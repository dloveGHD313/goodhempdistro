"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import LearningWithJaxNewsletter from "./LearningWithJaxNewsletter";
import { ScrollReveal, Stagger, StaggerChild, HoverLift } from "@/components/motion";
import { useMotion } from "@/components/motion";

const PILLARS = [
  { title: "Business & Development", description: "Vendor onboarding, listings, and growing your hemp business.", href: "/learning-with-jax/business", comingSoon: true, icon: "📈" },
  { title: "Hemp Basics", description: "Cannabis and hemp fundamentals, compliance basics, and terminology.", href: "/learning-with-jax/basics", comingSoon: true, icon: "🌿" },
  { title: "Webisodes", description: "Short-form episodes with JAX on marketplace tips and industry news.", href: "/learning-with-jax/webisodes", comingSoon: true, icon: "🎬" },
  { title: "Deep Dives", description: "In-depth guides on construction, logistics, and industrial hemp.", href: "/learning-with-jax/deep-dives", comingSoon: true, icon: "📚" },
] as const;

const TRACKS = [
  { title: "Hemp Building", description: "From materials to codes — build with hemp.", comingSoon: true, icon: "🏗️" },
  { title: "Hemp Business", description: "Selling, marketing, and scaling in the hemp economy.", comingSoon: true, icon: "💼" },
  { title: "Hemp Science", description: "Quality, testing, and the science behind hemp products.", comingSoon: true, icon: "🔬" },
  { title: "Hemp Lifestyle", description: "Consumer guides, wellness, and everyday hemp.", comingSoon: true, icon: "✨" },
] as const;

const hoverTransition = { duration: 0.18 };

export default function LearningWithJaxMotion() {
  const { reducedMotion } = useMotion();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <ScrollReveal once amount={0.15} className="w-full">
          <section
            className="welcome-hero py-12 sm:py-16 px-4 futuristic-glow min-h-[85vh] sm:min-h-[80vh]"
            aria-label="Learning with JAX"
          >
            <div className="relative z-10 max-w-6xl mx-auto w-full flex flex-col lg:flex-row items-center gap-10 lg:gap-12">
              <div className="flex-1 text-center lg:text-left">
                <h1 className="hero-title text-accent mb-3">Learning with JAX</h1>
                <p className="hero-subtitle hero-subtitle--left max-w-xl mb-8">
                  Build smarter. Sell smarter. Learn the hemp economy — from basics to industrial-grade execution.
                </p>
                <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                  <HoverLift as="span">
                    <Link href="#featured" className="btn-primary inline-block">
                      Watch Episode 001
                    </Link>
                  </HoverLift>
                  <HoverLift as="span">
                    <Link href="#topics" className="btn-secondary inline-block">
                      Explore Topics
                    </Link>
                  </HoverLift>
                </div>
              </div>
              <div className="flex-shrink-0 w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[360px]">
                <div className="relative aspect-square jax-hero-float">
                  <Image
                    src="/assets/jax/jax-hero.webp"
                    alt="JAX mascot — Learning with JAX"
                    width={360}
                    height={360}
                    sizes="(max-width: 640px) 280px, (max-width: 1024px) 320px, 360px"
                    quality={90}
                    className="object-contain w-full h-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                    priority
                  />
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal once amount={0.2}>
          <section
            id="pillars"
            className="section-shell bg-[var(--surface)]"
            aria-labelledby="pillars-heading"
          >
            <h2 id="pillars-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Where to start
            </h2>
            <p className="text-muted mb-8 max-w-2xl">
              Pick a pillar and follow along. New content is added regularly.
            </p>
            <Stagger staggerChildren={0.08} delayChildren={0.1} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {PILLARS.map((p) => (
                <StaggerChild key={p.title}>
                  <motion.div
                    className="card-glass p-6 flex flex-col rounded-xl"
                    whileHover={reducedMotion ? undefined : { scale: 1.02, y: -2 }}
                    transition={hoverTransition}
                  >
                    <span className="text-3xl mb-3 block" aria-hidden="true">{p.icon}</span>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{p.title}</h3>
                    <p className="text-muted text-sm flex-1 mb-4">{p.description}</p>
                    {p.comingSoon ? (
                      <span className="text-xs text-muted font-medium">Coming soon</span>
                    ) : (
                      <Link href={p.href} className="text-accent font-semibold text-sm hover:underline">View →</Link>
                    )}
                  </motion.div>
                </StaggerChild>
              ))}
            </Stagger>
          </section>
        </ScrollReveal>

        <ScrollReveal once amount={0.2}>
          <section
            id="featured"
            className="section-shell section-shell--tight"
            aria-labelledby="featured-heading"
          >
            <h2 id="featured-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Featured episode
            </h2>
            <p className="text-muted mb-8 max-w-2xl">
              Episode 001 — coming soon. Get notified when it drops.
            </p>
            <div className="max-w-3xl mx-auto">
              <motion.div
                className="card-glass overflow-hidden rounded-xl"
                whileHover={reducedMotion ? undefined : { y: -2 }}
                transition={hoverTransition}
              >
                <div className="aspect-video bg-[var(--bg)] flex items-center justify-center text-muted">
                  <span className="text-6xl" aria-hidden="true">🎬</span>
                </div>
                <div className="p-6 sm:p-8">
                  <h3 className="text-xl font-semibold text-foreground mb-4">Episode 001 (Coming Soon)</h3>
                  <ul className="space-y-2 text-muted mb-6 list-disc list-inside">
                    <li>How to list your first product on Good Hemp Distro</li>
                    <li>COA and compliance in 5 minutes</li>
                    <li>Pricing and positioning for hemp brands</li>
                  </ul>
                  <motion.span whileHover={reducedMotion ? undefined : { scale: 1.02, y: -2 }} transition={hoverTransition}>
                    <a href="#newsletter" className="btn-primary inline-block">Notify me</a>
                  </motion.span>
                </div>
              </motion.div>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal once amount={0.2}>
          <section
            id="topics"
            className="section-shell bg-[var(--surface)]"
            aria-labelledby="topics-heading"
          >
            <h2 id="topics-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Topic tracks
            </h2>
            <p className="text-muted mb-8 max-w-2xl">
              Follow a track from start to finish. Each has a clear path.
            </p>
            <Stagger staggerChildren={0.08} delayChildren={0.1} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {TRACKS.map((t) => (
                <StaggerChild key={t.title}>
                  <motion.div
                    className="card-glass p-6 flex flex-col rounded-xl"
                    whileHover={reducedMotion ? undefined : { scale: 1.02, y: -2 }}
                    transition={hoverTransition}
                  >
                    <span className="text-3xl mb-3 block" aria-hidden="true">{t.icon}</span>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{t.title}</h3>
                    <p className="text-muted text-sm flex-1 mb-4">{t.description}</p>
                    {t.comingSoon ? (
                      <span className="text-xs text-muted font-medium">Coming soon</span>
                    ) : (
                      <Link href={(t as { anchor?: string }).anchor ?? "#"} className="text-accent font-semibold text-sm hover:underline">Start here →</Link>
                    )}
                  </motion.div>
                </StaggerChild>
              ))}
            </Stagger>
          </section>
        </ScrollReveal>

        <ScrollReveal once amount={0.2}>
          <section
            className="section-shell futuristic-glow py-16"
            aria-labelledby="membership-heading"
          >
            <h2 id="membership-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-8 text-center">
              Get more from Learning with JAX
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="surface-glass rounded-[var(--radius-xl)] p-6 sm:p-8">
                <h3 className="text-lg font-semibold text-accent mb-3">Free</h3>
                <ul className="text-muted text-sm space-y-2 list-disc list-inside">
                  <li>Access to free episodes and guides</li>
                  <li>Topic track overviews</li>
                  <li>Community Q&A</li>
                </ul>
              </div>
              <div className="surface-glass rounded-[var(--radius-xl)] p-6 sm:p-8 border border-[var(--brand-lime)]/30">
                <h3 className="text-lg font-semibold text-accent mb-3">Paid</h3>
                <ul className="text-muted text-sm space-y-2 list-disc list-inside">
                  <li>All episodes and deep dives</li>
                  <li>Downloadable resources and templates</li>
                  <li>Early access and exclusive live sessions</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <motion.span whileHover={reducedMotion ? undefined : { scale: 1.02, y: -2 }} transition={hoverTransition}>
                <Link href="/pricing" className="btn-secondary inline-block">Compare Plans</Link>
              </motion.span>
              <motion.span whileHover={reducedMotion ? undefined : { scale: 1.02, y: -2 }} transition={hoverTransition}>
                <Link href="/pricing" className="btn-primary inline-block">Upgrade</Link>
              </motion.span>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal once amount={0.2}>
          <section
            id="newsletter"
            className="section-shell bg-[var(--surface)]"
            aria-labelledby="newsletter-heading"
          >
            <h2 id="newsletter-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-2 text-center">
              Stay in the loop
            </h2>
            <p className="text-muted mb-8 text-center max-w-xl mx-auto">
              Get notified when new episodes and guides drop. No spam.
            </p>
            <LearningWithJaxNewsletter />
          </section>
        </ScrollReveal>
      </main>
      <Footer />
    </div>
  );
}
