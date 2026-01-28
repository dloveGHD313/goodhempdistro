"use client";

import { useState } from "react";
import type { MascotId } from "./config";
import { mascotAssets } from "./config";

type Props = {
  mascot: MascotId;
  sources?: readonly string[];
  size?: number;
  move?: string;
};

export default function MascotAvatar({ mascot, sources, size = 48, move }: Props) {
  const asset = mascotAssets[mascot];
  const fallbackSources = sources?.length
    ? [...sources]
    : [asset.idleSrc, asset.fallbackSrc].filter(Boolean);
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = fallbackSources[sourceIndex] || asset.fallbackSrc;

  return (
    <div className="mascot-avatar" data-move={move} style={{ width: size, height: size }}>
      <img
        src={src}
        alt={`${asset.name} mascot`}
        width={size}
        height={size}
        loading="lazy"
        onError={() => {
          setSourceIndex((current) =>
            current + 1 < fallbackSources.length ? current + 1 : current
          );
        }}
      />
    </div>
  );
}
