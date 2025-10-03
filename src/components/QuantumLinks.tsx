// src/components/QuantumLinks.tsx
"use client";

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";


type Client = {
  id: string;
  position: [number, number, number];
  color?: [number, number, number];
};

type Props = {
  clients: Client[];
  /** Connect nodes only within this distance */
  threshold?: number;
  /** Number of segments per line (detail vs perf) */
  segments?: number;
  /** Max links per node to cap complexity (k-NN style). Set 0 to disable */
  maxLinksPerNode?: number;
  /** Wiggle amplitude */
  amplitude?: number;
  /** Spatial wave count along a link */
  waves?: number;
  /** Animation speed */
  speed?: number;
};

/**
 * QuantumLinks
 * - CRAWLER-FREE wiggly lines between nearby clients
 * - Optimized: precomputes bases + reuses buffers with DynamicDrawUsage
 * - Safe to mount inside <Canvas>; no R3F hooks outside
 */
export default function QuantumLinks({
  clients,
  threshold = 12,
  segments = 32,
  maxLinksPerNode = 6,
  amplitude = 0.18,
  waves = 10,
  speed = 3,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);

  // Build links once per clients change
  const lines = useMemo(() => {
    const elems: Array<{
      geometry: THREE.BufferGeometry;
      p1: THREE.Vector3;
      p2: THREE.Vector3;
      seed: number;
      segments: number;
      dir: THREE.Vector3;
      perpA: THREE.Vector3;
      perpB: THREE.Vector3;
    }> = [];

    if (!clients?.length) return elems;

    // Optional: cap links per node (approx k-NN within threshold)
    const indicesByNode: number[][] =
      maxLinksPerNode > 0
        ? clients.map((c, i) => {
            // simple nearest selection within threshold
            const pi = new THREE.Vector3(...c.position);
            const cand = clients
              .map((c2, j) => ({
                j,
                d:
                  i === j
                    ? Infinity
                    : pi.distanceTo(new THREE.Vector3(...c2.position)),
              }))
              .filter((x) => x.d <= threshold)
              .sort((a, b) => a.d - b.d)
              .slice(0, maxLinksPerNode)
              .map((x) => x.j);
            return cand;
          })
        : [];

    for (let i = 0; i < clients.length; i++) {
      const p1 = new THREE.Vector3(...clients[i].position);
      for (let j = i + 1; j < clients.length; j++) {
        // Apply threshold
        const p2 = new THREE.Vector3(...clients[j].position);
        const dist = p1.distanceTo(p2);
        if (dist > threshold) continue;

        // If capping, ensure either i selected j or j selected i
        if (
          maxLinksPerNode > 0 &&
          !(indicesByNode[i]?.includes(j) || indicesByNode[j]?.includes(i))
        ) {
          continue;
        }

        // Orthonormal basis for the line
        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
        const fallback =
          Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        const perpA = new THREE.Vector3().crossVectors(fallback, dir).normalize();
        const perpB = new THREE.Vector3().crossVectors(dir, perpA).normalize();

        // Initial straight line positions
        const points = new Float32Array((segments + 1) * 3);
        for (let k = 0; k <= segments; k++) {
          const t = k / segments;
          const base = new THREE.Vector3().lerpVectors(p1, p2, t);
          const idx = k * 3;
          points[idx] = base.x;
          points[idx + 1] = base.y;
          points[idx + 2] = base.z;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(points, 3).setUsage(THREE.DynamicDrawUsage)
        );

        elems.push({
          geometry,
          p1,
          p2,
          seed: Math.random() * 100,
          segments,
          dir,
          perpA,
          perpB,
        });
      }
    }

    return elems;
  }, [clients, threshold, segments, maxLinksPerNode]);

  // Dispose geometries when unmounting or rebuilding
  useEffect(() => {
    return () => {
      lines.forEach((l) => l.geometry.dispose());
    };
  }, [lines]);

  // Animate only the line wobble (no crawlers)
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const g = groupRef.current;
    if (!g) return;

    const base = new THREE.Vector3();

    for (let c = 0; c < g.children.length; c++) {
      const obj = g.children[c] as THREE.Line;
      const { p1, p2, seed, segments, perpA, perpB } = obj.userData as (typeof lines)[number];
      const attr = obj.geometry.getAttribute("position") as THREE.BufferAttribute;
      const positions = attr.array as Float32Array;

      for (let k = 0; k <= segments; k++) {
        const t = k / segments;
        base.lerpVectors(p1, p2, t);

        // rotate perpendicular smoothly via sin/cos
        const theta = (Math.PI * k) / segments;
        const spinX = Math.cos(theta);
        const spinY = Math.sin(theta);

        const offX = perpA.x * spinX + perpB.x * spinY;
        const offY = perpA.y * spinX + perpB.y * spinY;
        const offZ = perpA.z * spinX + perpB.z * spinY;

        const wiggle = Math.sin(t * waves + time * speed + seed) * amplitude;

        const idx = k * 3;
        positions[idx] = base.x + offX * wiggle;
        positions[idx + 1] = base.y + offY * wiggle;
        positions[idx + 2] = base.z + offZ * wiggle;
      }

      attr.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {lines.map((line, i) => (
        /* @ts-expect-error: three.js line element */
        <line key={i} geometry={line.geometry} userData={line}>
          {/* Note: linewidth is ignored in most browsers; use three-stdlib Line2 for true thickness */}
          <lineBasicMaterial color="#66ccff" transparent opacity={0.6} />
        </line>
      ))}
    </group>
  );
}
