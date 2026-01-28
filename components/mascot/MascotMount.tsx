"use client";

import dynamic from "next/dynamic";

const MascotWidget = dynamic(() => import("./MascotWidget"), { ssr: false });

export default function MascotMount() {
  return <MascotWidget />;
}
