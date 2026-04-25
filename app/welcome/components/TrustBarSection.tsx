import SectionReveal from "./SectionReveal";

const trustItems = [
  { icon: "🧪", text: "COA-Verified Products Only" },
  { icon: "✅", text: "Licensed Vendors" },
  { icon: "🔞", text: "21+ Platform" },
  { icon: "📋", text: "FDA Disclaimer Compliant" },
];

export default function TrustBarSection() {
  return (
    <section className="border-t border-b border-white/10 bg-[#0A100D] py-6 px-6">
      <SectionReveal>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-8 text-center">
            {trustItems.map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm text-[#8A9E96]">
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-[#4A5E57] mt-4 max-w-2xl mx-auto">
            These statements have not been evaluated by the FDA. Products are not intended to diagnose, treat, cure,
            or prevent any disease. Must be 21+ to purchase. State regulations vary.
          </p>
        </div>
      </SectionReveal>
    </section>
  );
}
