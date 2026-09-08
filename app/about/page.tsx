import { Metadata } from "next";
import Footer from "@/components/Footer";
import { brand } from "@/lib/brand";
import { Section, Stagger, StaggerChild, HoverLift } from "@/components/motion";

export const metadata: Metadata = {
  title: "About Good Hemp Distro | Nashville's Hemp Platform",
  description:
    "Good Hemp Distro is a hemp industry marketplace connecting verified vendors and informed consumers. Based in Nashville, TN. Serving nationwide.",
  openGraph: {
    title: "About Good Hemp Distro | Nashville's Hemp Platform",
    description:
      "Good Hemp Distro is a hemp industry marketplace connecting verified vendors and informed consumers. Based in Nashville, TN. Serving nationwide.",
    url: `${brand.url}/about`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Good Hemp Distro | Nashville's Hemp Platform",
    description:
      "Good Hemp Distro is a hemp industry marketplace connecting verified vendors and informed consumers. Based in Nashville, TN. Serving nationwide.",
  },
};

export default function AboutPage() {
  return (
    <>
      <main className="min-h-screen bg-[var(--bg)] text-white">
      <div className="container mx-auto px-4 py-16">
        {/* H1 rendered without Reveal so it is visible in initial HTML (LCP fix) */}
        <h1 className="text-4xl font-bold mb-8">About Good Hemp Distro</h1>

        <div className="max-w-3xl mx-auto">
          <Section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-accent">Our Mission</h2>
            <p className="text-muted text-lg leading-relaxed">
              Good Hemp Distro is dedicated to connecting customers with premium hemp products
              from trusted vendors. We believe in transparency, quality, and education in the
              rapidly evolving hemp industry.
            </p>
          </Section>

          <Section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-accent">Our Story</h2>
            <p className="text-muted text-lg leading-relaxed mb-4">
              Founded in 2023, Good Hemp Distro emerged from a passion for wellness and a
              recognition that consumers deserved better access to high-quality hemp products.
              We started with a simple goal: create a trusted marketplace where quality and
              transparency come first.
            </p>
            <p className="text-muted text-lg leading-relaxed">
              Today, we work with carefully selected vendors who share our commitment to
              excellence. Every product on our platform meets strict quality standards and
              is backed by third-party lab testing.
            </p>
          </Section>

          <Section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-accent">Our Values</h2>
            <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StaggerChild>
                <div className="bg-[var(--surface)] border border-white/10 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-2">Quality First</h3>
                  <p className="text-muted">
                    We only partner with vendors who meet our rigorous quality standards
                    and provide third-party lab testing.
                  </p>
                </div>
              </StaggerChild>

              <StaggerChild>
                <div className="bg-[var(--surface)] border border-white/10 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-2">Transparency</h3>
                  <p className="text-muted">
                    Full disclosure of product origins, ingredients, and lab results
                    for every item we carry.
                  </p>
                </div>
              </StaggerChild>

              <StaggerChild>
                <div className="bg-[var(--surface)] border border-white/10 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-2">Education</h3>
                  <p className="text-muted">
                    Empowering customers with knowledge about hemp products and
                    their potential benefits.
                  </p>
                </div>
              </StaggerChild>

              <StaggerChild>
                <div className="bg-[var(--surface)] border border-white/10 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-2">Sustainability</h3>
                  <p className="text-muted">
                    Supporting environmentally conscious farming practices and
                    sustainable business operations.
                  </p>
                </div>
              </StaggerChild>
            </Stagger>
          </Section>

          <Section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-accent">Why Choose Us</h2>
            <ul className="space-y-3 text-muted">
              <li className="flex items-start">
                <span className="text-accent mr-2">✓</span>
                <span>Curated selection of premium hemp products</span>
              </li>
              <li className="flex items-start">
                <span className="text-accent mr-2">✓</span>
                <span>Verified vendor partnerships with quality guarantees</span>
              </li>
              <li className="flex items-start">
                <span className="text-accent mr-2">✓</span>
                <span>Third-party lab testing for all products</span>
              </li>
              <li className="flex items-start">
                <span className="text-accent mr-2">✓</span>
                <span>Secure payment processing and fast shipping</span>
              </li>
              <li className="flex items-start">
                <span className="text-accent mr-2">✓</span>
                <span>Responsive customer support team</span>
              </li>
            </ul>
          </Section>

          <Section className="bg-[var(--surface)] border border-white/10 rounded-lg p-8">
            <h2 className="text-2xl font-semibold mb-4">Get in Touch</h2>
            <p className="text-muted mb-4">
              Have questions or want to learn more? We&apos;d love to hear from you.
            </p>
            <HoverLift as="span">
              <a
                href="/contact"
                className="inline-block btn-primary px-6 py-3 rounded-lg transition"
              >
                Contact Us
              </a>
            </HoverLift>
          </Section>
        </div>
      </div>
    </main>
      <Footer />
    </>
  );
}
