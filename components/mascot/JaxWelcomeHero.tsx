"use client";

import Image from "next/image";
import { mascotAssets } from "./config";
import { getMascotFlagStatus } from "@/lib/mascotFlags";

type Props = {
  selectedCount: number;
};

const asset = mascotAssets.JAX;

export default function JaxWelcomeHero({ selectedCount }: Props) {
  const { clientEnabled, serverEnabled } = getMascotFlagStatus();
  const visible = clientEnabled && serverEnabled;

  if (!visible) return null;

  const dialogue =
    selectedCount === 0
      ? "Hey, I'm JAX. Pick everything you're here for…"
      : "Nice. I'll tailor your experience around that.";

  return (
    <div
      className="mb-10 motion-heavy animate-fade-in opacity-0"
      style={{ animationDelay: "0s" }}
      role="img"
      aria-label="JAX mascot"
    >
      <div
        className="animate-scale-in opacity-0 flex flex-col items-center"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="w-28 h-28 md:w-36 md:h-36 relative mb-4">
          <Image
            src={asset.idleSrc}
            alt=""
            width={144}
            height={144}
            className="object-contain"
            priority
          />
        </div>
        <p className="text-white text-lg md:text-xl max-w-sm text-center px-4">
          {dialogue}
        </p>
      </div>
    </div>
  );
}
