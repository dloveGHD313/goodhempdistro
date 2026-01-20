import Link from "next/link";
import ResetPasswordRedirect from "@/components/ResetPasswordRedirect";

export default function Home() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="w-full flex-1">
        <section className="hero-glow">
          <div className="section-shell text-center hero-content">
            <div className="max-w-3xl mx-auto">
              <p className="text-sm uppercase tracking-[0.3em] text-muted mb-4">Good Hemp Distros</p>
              <h1 className="hero-title font-black mb-5 text-accent">
                Premium Hemp Marketplace
              </h1>
              <p className="hero-subtitle mb-10">
                High-quality hemp products from verified vendors. Join the community and explore curated drops.
              </p>
              <div className="flex flex-col md:flex-row gap-4 justify-center">
                <Link href="/get-started" className="btn-primary text-base md:text-lg py-4 px-8">
                  🚀 Get Started Now
                </Link>
                <Link href="/newsfeed" className="btn-secondary text-base md:text-lg py-4 px-8">
                  📰 Browse Feed
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section-shell section-shell--tight">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "🔒", title: "Secure Checkout", desc: "Encrypted payments with Stripe" },
              { icon: "📦", title: "Fast Shipping", desc: "Discreet delivery to all 50 states" },
              { icon: "✅", title: "Lab Verified", desc: "All products tested & certified" }
            ].map((feature, i) => (
              <div key={i} className="card-glass card-glass--raised p-6">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="font-bold text-lg mb-2 text-accent">{feature.title}</h3>
                <p className="text-muted text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-shell section-shell--tight">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-accent mb-3">
              Explore the Community
            </h2>
            <p className="text-muted">Stay plugged into the latest drops, groups, and conversations.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { emoji: "🏠", label: "News Feed", href: "/newsfeed", desc: "Latest updates from the community" },
              { emoji: "🛍️", label: "Shop Products", href: "/products", desc: "Browse premium hemp products" },
              { emoji: "👥", label: "Groups", href: "/groups", desc: "Join community groups" },
              { emoji: "💬", label: "Forums", href: "/forums", desc: "Discuss & connect" },
            ].map((link, i) => (
              <Link key={i} href={link.href} className="card-glass p-5 hover-lift">
                <div className="text-2xl mb-2">{link.emoji}</div>
                <h3 className="font-bold text-lg mb-1">{link.label}</h3>
                <p className="text-muted text-sm">{link.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="section-shell section-shell--tight text-center">
          <div className="card-glass card-glass--raised p-10">
            <h3 className="text-2xl md:text-3xl font-bold text-accent mb-4">Ready to Join?</h3>
            <p className="text-muted mb-8 text-lg">
              Start exploring premium hemp products and connect with our community.
            </p>
            <Link href="/get-started" className="btn-primary text-base md:text-lg py-3 px-8 inline-block">
              🚀 Get Started
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] mt-8 py-8 px-4 text-center text-muted">
        <p>&copy; 2026 Good Hemp Distro. All rights reserved.</p>
      </footer>
      <ResetPasswordRedirect />
    </div>
  );
}
