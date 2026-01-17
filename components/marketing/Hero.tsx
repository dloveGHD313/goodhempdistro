import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse-glow animation-delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background opacity-40" />

      <div className="section-shell relative z-10 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full glass-card text-sm">
            <Leaf className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">The Future of Hemp Distribution</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6">
            <span className="text-gradient-lime">Premium Hemp</span>
            <br />
            <span className="text-foreground">Marketplace</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect with verified vendors, discover lab-tested products, and join the
            community redefining the hemp industry.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/products"
              className="btn-gold px-8 py-6 text-lg rounded-xl glow-gold hover-glow-gold group"
            >
              Start Shopping
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/vendor-registration"
              className="btn-secondary px-8 py-6 text-lg rounded-xl"
            >
              Become a Vendor
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-8 mt-20 pt-10 border-t border-border/30">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-gradient-lime">500+</div>
              <div className="text-sm text-muted-foreground mt-1">Verified Vendors</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-gradient-lime">10K+</div>
              <div className="text-sm text-muted-foreground mt-1">Products Listed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-gradient-lime">50K+</div>
              <div className="text-sm text-muted-foreground mt-1">Happy Customers</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
