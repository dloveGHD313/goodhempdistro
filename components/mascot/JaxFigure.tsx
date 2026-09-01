"use client";

import Image from "next/image";
import { useState } from "react";
import { getJaxOutfit } from "@/lib/jaxOutfits";

type JaxFigureProps = {
  /** Outfit key from lib/jaxOutfits (welcome | categories | builder | community | vendor | learning). */
  outfit: string;
  /** Rendered width in px (height follows the 2:3 master aspect). */
  width?: number;
  showCaption?: boolean;
  className?: string;
  priority?: boolean;
};

/**
 * Site-wide JAX figure. Tries the page-specific outfit art first and falls
 * back to the master base art if that outfit PNG hasn't shipped yet, so JAX
 * stays consistent everywhere and outfits activate the moment the asset lands
 * in public/mascot/jax/outfits/. See docs/JAX-OUTFITS-SPEC.md.
 */
export default function JaxFigure({
  outfit,
  width = 220,
  showCaption = true,
  className = "",
  priority = false,
}: JaxFigureProps) {
  const spec = getJaxOutfit(outfit);
  const [src, setSrc] = useState(spec.src);
  const height = Math.round(width * 1.5);

  return (
    <figure className={`flex flex-col items-center ${className}`}>
      <Image
        src={src}
        alt={spec.alt}
        width={width}
        height={height}
        priority={priority}
        className="select-none drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
        onError={() => {
          if (src !== spec.fallbackSrc) setSrc(spec.fallbackSrc);
        }}
        unoptimized
      />
      {showCaption && (
        <figcaption className="mt-3 text-xs uppercase tracking-[0.2em] text-[#3CB97A] text-center">
          {spec.caption}
        </figcaption>
      )}
    </figure>
  );
}
