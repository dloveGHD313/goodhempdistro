"use client";

import { useState } from "react";
import type { MascotId } from "./config";
import { mascotAssets } from "./config";

type Props = {
  mascot: MascotId;
  size?: number;
  move?: string;
};

export default function MascotAvatar({ mascot, size = 48, move }: Props) {
  const asset = mascotAssets[mascot];
  const [src, setSrc] = useState(asset.idleSrc);

  return (
    <div className="mascot-avatar" data-move={move} style={{ width: size, height: size }}>
      <img
        src={src}
        alt={`${asset.name} mascot`}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setSrc(asset.fallbackSrc)}
      />
    </div>
  );
}
