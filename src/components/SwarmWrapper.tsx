"use client";

import dynamic from "next/dynamic";

// prevent SSR entirely
const SwarmCanvas = dynamic(() => import("./SwarmCanvas"), { ssr: false });

export default function SwarmWrapper() {
  return <SwarmCanvas />;
}
