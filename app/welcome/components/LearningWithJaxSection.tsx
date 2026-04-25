import Link from "next/link";
import SectionReveal from "./SectionReveal";

const episodes = [
  { title: "COA Basics for Buyers", meta: "Episode 01 • 11 min" },
  { title: "Vendor Compliance Essentials", meta: "Episode 02 • 15 min" },
  { title: "Scaling Hemp Operations", meta: "Episode 03 • 13 min" },
];

export default function LearningWithJaxSection() {
  return (
    <section className="px-6 py-20 bg-[#0D1512]">
      <SectionReveal>
        <div className="max-w-6xl mx-auto border border-white/10 bg-[#141F1A] rounded-2xl overflow-hidden md:grid md:grid-cols-5">
          <div className="w-1 bg-[#3CB97A] md:row-span-1" />
          <div className="p-8 md:p-10 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.3em] text-[#3CB97A] mb-3">EDUCATION</p>
            <h2 className="text-3xl text-[#F0EDE6] mb-4 font-serif">Learn the Industry with Jax</h2>
            <p className="text-[#8A9E96] mb-7">
              Episodes that educate vendors and consumers on hemp compliance, business growth, and product knowledge.
            </p>
            <Link
              href="/learning-with-jax"
              className="inline-block px-6 py-3 rounded-xl border border-[#3CB97A] text-[#3CB97A] font-semibold hover:bg-[#1A2820] transition"
            >
              Watch Episodes →
            </Link>
          </div>

          <div className="p-8 md:p-10 md:col-span-2 grid gap-4">
            {episodes.map((episode) => (
              <article key={episode.title} className="rounded-xl border border-white/10 bg-[#0D1512] p-4">
                <div className="aspect-video rounded-lg bg-[#1A2820] mb-3 flex items-center justify-center text-3xl">🎬</div>
                <h3 className="text-sm font-medium text-[#F0EDE6] mb-1">{episode.title}</h3>
                <p className="text-xs text-[#4A5E57]">{episode.meta}</p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}
