import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import JaxFigure from "@/components/mascot/JaxFigure";

export const metadata: Metadata = {
  title: "Page not found | Good Hemp Distro",
  robots: { index: false, follow: false },
};

/** Site-wide 404 — JAX points the visitor back to a real door. */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="surface-card mx-auto flex max-w-3xl flex-col items-center gap-8 p-8 text-center md:flex-row md:text-left">
            <div className="w-[140px] shrink-0">
              <JaxFigure outfit="welcome" width={140} showCaption={false} className="w-full [&_img]:h-auto [&_img]:w-full" />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.3em] text-accent">404</p>
              <h1 className="text-3xl font-bold md:text-4xl">That page isn&apos;t on the map.</h1>
              <p className="mt-3 text-muted">
                The link may be old or mistyped. Pick a door and JAX takes it from here.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                <Link href="/products" className="btn-primary">Shop</Link>
                <Link href="/projects/estimator" className="btn-secondary">Build with hemp</Link>
                <Link href="/vendor-registration" className="btn-secondary">Sell</Link>
                <Link href="/welcome?noboot=1" className="btn-ghost">Home</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
