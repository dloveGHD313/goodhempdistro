"use client";

import dynamic from "next/dynamic";

const MascotMount = dynamic(() => import("./MascotMount"), { ssr: false });

export default function MascotMountClient() {
  return <MascotMount />;
}
