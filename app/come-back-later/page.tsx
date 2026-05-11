import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Come Back When You're 21 | Good Hemp Distro",
  description:
    "Good Hemp Distro is a hemp marketplace for adults 21 and older. Come back when you meet the minimum age requirement.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ComeBackLaterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0D1512] text-[#F0EDE6]">
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-lg text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[#3CB97A] mb-3">
            Good Hemp Distro
          </p>
          <div className="mx-auto h-px w-16 bg-[#3CB97A]/40 mb-8" aria-hidden="true" />

          <h1 className="text-3xl sm:text-4xl font-serif mb-5">
            Come back when you&apos;re 21.
          </h1>

          <p className="text-base text-[#8A9E96] leading-relaxed mb-8">
            Good Hemp Distro is a hemp marketplace built for adults 21 and
            older. Hemp-derived products on this platform are intended for
            customers who meet the minimum age requirement in their state.
          </p>

          <p className="text-sm text-[#8A9E96] leading-relaxed mb-10">
            If you&apos;re interested in hemp education, you can read our
            informational resources without making a purchase.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/learning-with-jax"
              className="rounded-lg border border-white/15 px-5 py-3 text-sm text-[#F0EDE6] hover:border-white/30 transition-colors"
            >
              Hemp education
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-[#3CB97A]/15 border border-[#3CB97A]/30 px-5 py-3 text-sm text-[#3CB97A] hover:bg-[#3CB97A]/20 transition-colors"
            >
              Return to home
            </Link>
          </div>

          <p className="mt-12 text-xs text-[#8A9E96]/60 leading-relaxed">
            FDA disclaimer: These statements have not been evaluated by the FDA.
            Hemp products are not intended to diagnose, treat, cure, or prevent
            any disease.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
