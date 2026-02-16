"use client";

import Image from "next/image";
import { useState } from "react";

const RENDER_SIZE = 160;

type Props = {
  filename: string;
  src: string;
};

export default function MascotAssetCard({ filename, src }: Props) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 p-4 flex flex-col items-center gap-2">
      <div className="relative w-[160px] h-[160px] flex items-center justify-center bg-[var(--surface)] rounded overflow-hidden">
        <Image
          src={src}
          alt={filename}
          width={RENDER_SIZE}
          height={RENDER_SIZE}
          sizes={`${RENDER_SIZE}px`}
          quality={90}
          className="object-contain w-full h-full"
          onLoad={(e) => {
            const target = e.target as HTMLImageElement;
            setNatural({
              w: target.naturalWidth,
              h: target.naturalHeight,
            });
          }}
        />
      </div>
      <p className="text-sm font-mono text-[var(--muted)] truncate w-full text-center" title={filename}>
        {filename}
      </p>
      <p className="text-xs text-[var(--muted)]">
        Rendered: {RENDER_SIZE}×{RENDER_SIZE}
      </p>
      {natural && (
        <p className="text-xs text-[var(--accent)]">
          Natural: {natural.w}×{natural.h}
        </p>
      )}
    </div>
  );
}
