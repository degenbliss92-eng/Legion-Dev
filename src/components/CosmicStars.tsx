"use client";

import { Stars } from "@react-three/drei";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function CosmicStars() {
  const starsRef = useRef<any>(null);

  useFrame(({ clock }) => {
    if (starsRef.current) {
      // gentle, subtle drift
      starsRef.current.rotation.y = clock.getElapsedTime() * 0.0015;
      starsRef.current.rotation.x =
        Math.sin(clock.getElapsedTime() * 0.0002) * 0.02;
    }
  });

  return (
    <Stars
      ref={starsRef}
      radius={180}     // spread of starfield
      depth={60}       // thickness
      count={2500}     // fewer stars (less distracting)
      factor={1.5}     // small star size
      saturation={0}   // grayscale stars
      fade
      speed={0}        // 👈 no twinkling
    />
  );
}
