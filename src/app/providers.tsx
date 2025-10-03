"use client";

import { ReactNode } from "react";
import { SwarmProvider } from "@/context/SwarmProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <SwarmProvider>{children}</SwarmProvider>;
}

