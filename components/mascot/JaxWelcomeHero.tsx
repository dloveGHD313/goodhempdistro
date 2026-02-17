"use client";

import Image from "next/image";

type Props = {
  selectedCount: number;
};

export default function JaxWelcomeHero({ selectedCount }: Props) {
  const enabled = process.env.NEXT_PUBLIC_MASCOT_ENABLED === "true";
  if (!enabled) return null;

  const dialogue =
    selectedCount === 0
      ? "Hey, I'm JAX. Pick everything you're here for…"
      : "Nice. I'll tailor your experience around that.";

  return (
    <section
      className="mx-auto w-full max-w-md flex flex-col items-center justify-center gap-3 flex-shrink-0 mb-8 motion-heavy animate-fade-in opacity-0"
      aria-label="JAX mascot greeting"
      style={{ animationDelay: "0s" }}
    >
      <div
        className="animate-scale-in opacity-0 flex flex-col items-center w-full"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="relative w-[140px] sm:w-[160px] md:w-[180px] h-[140px] sm:h-[160px] md:h-[180px] flex-shrink-0 mb-4" aria-hidden="true">
          <Image
            src="/brand/mascot-social.png"
            alt="Good Hemp Distro mascot"
            width={180}
            height={180}
            sizes="(max-width: 640px) 140px, (max-width: 768px) 160px, 180px"
            quality={95}
            className="object-contain w-full h-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            priority
          />
        </div>
        <p className="text-white text-lg md:text-xl max-w-sm text-center px-4">
          {dialogue}
        </p>
      </div>
    </section>
  );
}
