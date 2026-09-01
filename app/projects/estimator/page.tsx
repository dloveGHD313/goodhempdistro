import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import Footer from "@/components/Footer";
import JaxFigure from "@/components/mascot/JaxFigure";
import EstimatorClient from "./EstimatorClient";

export const metadata: Metadata = {
  title: "Hemp Material Estimator | Good Hemp Distro",
  description:
    "Estimate the hemp building materials your project needs — hemp hurd, lime binder, blocks, and insulation — then get matched with the vendors who supply them.",
  openGraph: {
    title: "Hemp Material Estimator | Good Hemp Distro",
    description:
      "Estimate hurd, binder, blocks, and hemp insulation for your build, then get matched with vendors.",
    url: `${brand.url}/projects/estimator`,
    siteName: brand.name,
    type: "website",
  },
};

export default function EstimatorPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell max-w-3xl mx-auto pt-10 pb-16">
          <div className="text-center mb-10">
            <div className="hidden sm:flex justify-center mb-6">
              <JaxFigure outfit="builder" width={140} showCaption={false} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-accent mb-3">
              Hemp Material Estimator
            </h1>
            <p className="text-muted max-w-2xl mx-auto">
              Rough out the materials for your hemp build — hurd, lime binder, blocks, and
              insulation — then send the project to us and we&apos;ll match you with the
              vendors who supply every line item.
            </p>
          </div>
          <EstimatorClient />
        </section>
      </main>
      <Footer />
    </div>
  );
}
