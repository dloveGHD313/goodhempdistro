import Link from "next/link";
import Nav from "@/components/Nav";

export default function Home() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      {/* Hero Section - Mobile-First with Green Accents */}
      <main className="w-full flex-1">
        {/* Top Hero with Gradient Background */}
        <section 
          className="w-full py-12 md:py-20 px-4 md:px-6 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(87, 209, 10, 0.15) 0%, rgba(255, 106, 43, 0.05) 100%)",
            borderBottom: "2px solid var(--accent-green)"
          }}
        >
          <div className="max-w-2xl mx-auto">
            <h1 
              className="text-3xl md:text-5xl font-black mb-4 leading-tight"
              style={{ color: "var(--accent-green)" }}
            >
              🌿 Premium Hemp Marketplace
            </h1>
            <p className="text-lg md:text-xl text-slate-200 mb-8">
              High-quality hemp products from verified vendors. Join the community.
            </p>
            
            {/* Prominent CTA Button - Extra Large on Mobile */}
            <div className="flex flex-col md:flex-row gap-3 justify-center mb-8">
              <Link 
                href="/get-started" 
                className="btn-cta text-base md:text-lg py-4 px-8 font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                🚀 Get Started Now
              </Link>
              <Link 
                href="/newsfeed" 
                className="inline-block border-2 border-[var(--accent-green)] text-[var(--accent-green)] hover:bg-[var(--accent-green)]/10 py-4 px-8 rounded-lg font-bold transition text-base md:text-lg"
              >
                📰 Browse Feed
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid - Green Accents */}
        <section className="w-full py-12 md:py-16 px-4 md:px-6 bg-[var(--surface)]/50">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "🔒", title: "Secure Checkout", desc: "Encrypted payments with Stripe" },
              { icon: "📦", title: "Fast Shipping", desc: "Discreet delivery to all 50 states" },
              { icon: "✅", title: "Lab Verified", desc: "All products tested & certified" }
            ].map((feature, i) => (
              <div 
                key={i}
                className="p-6 rounded-xl border-2 border-[var(--accent-green)]/30 hover:border-[var(--accent-green)] transition"
                style={{ backgroundColor: "rgba(87, 209, 10, 0.08)" }}
              >
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "var(--accent-green)" }}>{feature.title}</h3>
                <p className="text-slate-300 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Links - Feed First Layout */}
        <section className="w-full py-12 md:py-16 px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center" style={{ color: "var(--accent-green)" }}>
              Explore the Community
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { emoji: "🏠", label: "News Feed", href: "/newsfeed", desc: "Latest updates from the community" },
                { emoji: "🛍️", label: "Shop Products", href: "/products", desc: "Browse premium hemp products" },
                { emoji: "👥", label: "Groups", href: "/groups", desc: "Join community groups" },
                { emoji: "💬", label: "Forums", href: "/forums", desc: "Discuss & connect" },
              ].map((link, i) => (
                <Link
                  key={i}
                  href={link.href}
                  className="p-5 rounded-lg border-2 border-[var(--accent-green)]/40 hover:border-[var(--accent-green)] hover:bg-[var(--accent-green)]/10 transition"
                >
                  <div className="text-2xl mb-2">{link.emoji}</div>
                  <h3 className="font-bold text-lg mb-1">{link.label}</h3>
                  <p className="text-slate-400 text-sm">{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Secondary CTA */}
        <section className="w-full py-12 md:py-16 px-4 md:px-6 text-center" style={{ borderTop: "2px solid var(--accent-green)" }}>
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>Ready to Join?</h3>
            <p className="text-slate-300 mb-8 text-lg">Start exploring premium hemp products and connect with our community.</p>
            <Link href="/get-started" className="btn-cta text-base md:text-lg py-3 px-8 font-bold inline-block">
              🚀 Get Started
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--accent-green)]/30 mt-8 py-8 px-4 text-center text-slate-400">
        <p>&copy; 2026 Good Hemp Distro. All rights reserved.</p>
      </footer>
    </div>
  );
}
