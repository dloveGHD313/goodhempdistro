import Link from "next/link";
import SectionReveal from "./SectionReveal";
import JaxFigure from "@/components/mascot/JaxFigure";

export type WelcomeEpisode = {
  id: string;
  title: string;
  meta: string;
};

export default function LearningWithJaxSection({ episodes = [] }: { episodes?: WelcomeEpisode[] }) {
  return (
    <section className="px-6 py-20 bg-[#0D1512]">
      <SectionReveal>
        <div className="max-w-6xl mx-auto border border-white/10 bg-[#141F1A] rounded-2xl overflow-hidden md:grid md:grid-cols-5">
          <div className="w-1 bg-[#3CB97A] md:row-span-1" />
          <div className="p-8 md:p-10 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.3em] text-[#3CB97A] mb-3">EDUCATION</p>
            <h2 className="text-3xl text-[#F0EDE6] mb-4 font-serif">Learning with JAX</h2>
            <p className="text-[#8A9E96] mb-7">
              JAX breaks down hemp compliance, business growth, and product knowledge —
              for vendors and the hemp-curious alike. New episodes as the platform grows.
            </p>
            <Link
              href="/learning-with-jax"
              className="inline-block px-6 py-3 rounded-xl border border-[#3CB97A] text-[#3CB97A] font-semibold hover:bg-[#1A2820] transition"
            >
              Watch Episodes →
            </Link>
          </div>

          <div className="p-8 md:p-10 md:col-span-2 grid gap-4 content-center">
            {episodes.length > 0 ? (
              episodes.slice(0, 3).map((episode) => (
                <article key={episode.id} className="rounded-xl border border-white/10 bg-[#0D1512] p-4">
                  <h3 className="text-sm font-medium text-[#F0EDE6] mb-1">{episode.title}</h3>
                  <p className="text-xs text-[#4A5E57]">{episode.meta}</p>
                </article>
              ))
            ) : (
              <article className="rounded-xl border border-white/10 bg-[#0D1512] p-4">
                <h3 className="text-sm font-medium text-[#F0EDE6] mb-1">
                  Hemp vs Weed — Settle It Forever
                </h3>
                <p className="text-xs text-[#4A5E57]">Webisode • Watch now</p>
              </article>
            )}
            <div className="hidden md:flex justify-center pt-2">
              <JaxFigure outfit="learning" width={150} showCaption={false} />
            </div>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}
