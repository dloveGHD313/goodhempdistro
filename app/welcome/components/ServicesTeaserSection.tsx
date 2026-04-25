import Link from "next/link";
import SectionReveal from "./SectionReveal";

const services = [
  { icon: "⚖️", label: "Cannabis Attorneys", desc: "Legal compliance & licensing" },
  { icon: "🔬", label: "COA Analysis", desc: "Lab testing & verification" },
  { icon: "🏦", label: "Cannabis-Friendly Banks", desc: "Financial services" },
  { icon: "🏷️", label: "White-Label Partners", desc: "Private label products" },
  { icon: "🌾", label: "Farm Leasing", desc: "Land & growing contracts" },
  { icon: "🛡️", label: "Insurance Providers", desc: "Business coverage" },
];

export default function ServicesTeaserSection() {
  return (
    <section className="px-6 py-20 bg-[#141F1A]">
      <SectionReveal>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#3CB97A] mb-3">DIRECTORY</p>
              <h2 className="text-4xl text-[#F0EDE6] mb-3 font-serif">Hemp Industry Services</h2>
              <p className="text-[#8A9E96]">Connect with professionals who understand your business.</p>
            </div>
            <Link href="/services" className="text-[#3CB97A] font-semibold hover:underline">
              Browse All Services →
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {services.map((service) => (
              <article
                key={service.label}
                className="bg-[#141F1A] border border-white/10 rounded-2xl p-6 hover:border-[rgba(60,185,122,0.3)] hover:bg-[#1A2820] transition-all duration-200"
              >
                <p className="text-2xl mb-3">{service.icon}</p>
                <h3 className="font-semibold text-[#F0EDE6] text-sm">{service.label}</h3>
                <p className="text-xs text-[#4A5E57] mt-1">{service.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}
