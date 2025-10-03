"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { RefreshCw, ZoomIn, ZoomOut, MessagesSquare } from "lucide-react";
import * as THREE from "three";
import MetaBall from "./MetaBall";
import ClientDetailsOverlay from "./ClientDetailsOverlay";
import GroupChat from "./GroupChat";
import { useSwarm } from "@/context/SwarmProvider";
import { useRouter } from "next/navigation";

// Keeps uTime ticking for shader uniforms
function GlobalUniformsUpdater({ uniformsRef }: { uniformsRef: React.RefObject<any> }) {
  useFrame(({ clock }) => {
    if (uniformsRef.current) uniformsRef.current.uTime.value = clock.getElapsedTime();
  });
  return null;
}

/** ---------------- QuantumLinks ---------------- */
function QuantumLinks({ clients }: { clients: any[] }) {
  const groupRef = useRef<THREE.Group>(null);

  const SEGMENTS = 32;
  const AMPLITUDE = 0.18;
  const WAVES = 10;
  const SPEED = 3;

  type LineData = {
    p1: THREE.Vector3;
    p2: THREE.Vector3;
    seed: number;
    segments: number;
    perpA: THREE.Vector3;
    perpB: THREE.Vector3;
  };

  type LineEntry = {
    key: string;
    geometry: THREE.BufferGeometry;
    data: LineData;
  };

  const clientCount = clients?.length ?? 0;
  const linkParams = useMemo(() => {
    if (clientCount >= 90) return { threshold: 8, maxLinks: 3 };
    if (clientCount >= 60) return { threshold: 9, maxLinks: 4 };
    if (clientCount >= 30) return { threshold: 10.5, maxLinks: 5 };
    return { threshold: 12, maxLinks: 6 };
  }, [clientCount]);

  const lines = useMemo<LineEntry[]>(() => {
    if (!clients?.length) return [];

    const { threshold, maxLinks } = linkParams;

    const positions = clients.map((client) => new THREE.Vector3(...client.position));
    const total = positions.length;

    type Candidate = { i: number; j: number; dist: number };
    const candidates: Candidate[] = [];
    for (let i = 0; i < total; i++) {
      for (let j = i + 1; j < total; j++) {
        const dist = positions[i].distanceTo(positions[j]);
        candidates.push({ i, j, dist });
      }
    }

    candidates.sort((a, b) => a.dist - b.dist);

    const degrees = Array.from({ length: total }, () => 0);
    const pairSet = new Set<string>();
    const selected: Array<{ i: number; j: number }> = [];

    const encode = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

    for (const { i, j, dist } of candidates) {
      if (dist > threshold) continue;
      if (degrees[i] >= maxLinks || degrees[j] >= maxLinks) continue;

      const key = encode(i, j);
      if (pairSet.has(key)) continue;

      pairSet.add(key);
      selected.push({ i, j });
      degrees[i] += 1;
      degrees[j] += 1;
    }

    for (let i = 0; i < total; i++) {
      if (degrees[i] > 0) continue;
      const fallback = candidates.find((pair) => pair.i === i || pair.j === i);
      if (!fallback) continue;

      const key = encode(fallback.i, fallback.j);
      if (pairSet.has(key)) continue;

      pairSet.add(key);
      selected.push({ i: fallback.i, j: fallback.j });
      degrees[fallback.i] += 1;
      degrees[fallback.j] += 1;
    }

    return selected.map(({ i, j }) => {
      const p1 = positions[i].clone();
      const p2 = positions[j].clone();

      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const fallback =
        Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const perpA = new THREE.Vector3().crossVectors(fallback, dir).normalize();
      const perpB = new THREE.Vector3().crossVectors(dir, perpA).normalize();

      const segments = SEGMENTS;
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

      return {
        key: encode(i, j),
        geometry,
        data: {
          p1,
          p2,
          seed: Math.random() * 100,
          segments,
          perpA,
          perpB,
        },
      };
    });
  }, [clients, linkParams]);

  useEffect(() => {
    return () => {
      lines.forEach((line) => line.geometry.dispose());
    };
  }, [lines]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const base = new THREE.Vector3();
    const group = groupRef.current;
    if (!group) return;

    for (let idx = 0; idx < group.children.length; idx++) {
      const lineObj = group.children[idx] as THREE.Line;
      const { p1, p2, seed, segments, perpA, perpB } = lineObj.userData as LineData;
      const attr = lineObj.geometry.getAttribute("position") as THREE.BufferAttribute;
      const positions = attr.array as Float32Array;

      for (let k = 0; k <= segments; k++) {
        const t = k / segments;
        base.lerpVectors(p1, p2, t);

        const theta = (Math.PI * k) / segments;
        const spinX = Math.cos(theta);
        const spinY = Math.sin(theta);

        const offX = perpA.x * spinX + perpB.x * spinY;
        const offY = perpA.y * spinX + perpB.y * spinY;
        const offZ = perpA.z * spinX + perpB.z * spinY;

        const wave = Math.sin(t * WAVES + time * SPEED + seed) * AMPLITUDE;

        const index = k * 3;
        positions[index] = base.x + offX * wave;
        positions[index + 1] = base.y + offY * wave;
        positions[index + 2] = base.z + offZ * wave;
      }

      attr.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {lines.map((line) => (
        /* @ts-expect-error: three.js line element */
        <line key={line.key} geometry={line.geometry} userData={line.data}>
          <lineBasicMaterial color="#66ccff" transparent opacity={0.6} />
        </line>
      ))}
    </group>
  );
}
/** ---------------- Camera Controls ---------------- */
function FocusController({
  myPosition,
  resetSignal,
  zoomSignal,
}: {
  myPosition: THREE.Vector3 | null;
  resetSignal: number;
  zoomSignal: { action: "in" | "out"; trigger: number };
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const hasFocusedRef = useRef(false);

  const focusOn = (target: THREE.Vector3, opts?: { instant?: boolean; distance?: number }) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const distance = opts?.distance ?? 8;
    const dir = new THREE.Vector3(1, 0.6, 1).normalize();
    const desiredTarget = target.clone();
    const desiredPos = desiredTarget.clone().addScaledVector(dir, distance);

    if (opts?.instant) {
      camera.position.copy(desiredPos);
      controls.target.copy(desiredTarget);
      controls.update();
      return;
    }

    const duration = 0.8;
    let t = 0;
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();

    const step = () => {
      t += 1 / 60 / duration;
      const k = t < 1 ? (1 - Math.cos(Math.PI * t)) / 2 : 1;
      camera.position.lerpVectors(startPos, desiredPos, k);
      controls.target.lerpVectors(startTarget, desiredTarget, k);
      controls.update();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const zoomBy = (factor: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const cam = controls.object as THREE.PerspectiveCamera;
    const target = controls.target.clone();

    const startPos = cam.position.clone();
    const dir = new THREE.Vector3().subVectors(startPos, target);
    const desiredPos = target.clone().addScaledVector(dir, factor);

    let t = 0;
    const duration = 0.6;
    const step = () => {
      t += 1 / 60 / duration;
      const k = t < 1 ? (1 - Math.cos(Math.PI * t)) / 2 : 1;
      cam.position.lerpVectors(startPos, desiredPos, k);
      controls.update();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!myPosition || hasFocusedRef.current === true) return;
    hasFocusedRef.current = true;
    focusOn(myPosition, { instant: true });
  }, [myPosition?.x, myPosition?.y, myPosition?.z]);

  useEffect(() => {
    if (!myPosition) return;
    focusOn(myPosition, { instant: false });
  }, [resetSignal]);

  useEffect(() => {
    if (!zoomSignal.trigger) return;
    zoomBy(zoomSignal.action === "in" ? 0.6 : 1.6);
  }, [zoomSignal]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={1}
      maxDistance={5000}
    />
  );
}

/** ---------------- SwarmCanvas ---------------- */
export default function SwarmCanvas() {
  const { clients, myId, votes, query, notificationCount } = useSwarm();
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const router = useRouter();
  const globalUniforms = useRef({ uTime: { value: 0 } });
  const [resetSignal, setResetSignal] = useState(0);
  const [zoomSignal, setZoomSignal] = useState<{ action: "in" | "out"; trigger: number }>({
    action: "in",
    trigger: 0,
  });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const myPosition = useMemo(() => {
    const me = clients.find((c) => c.id === myId);
    return me ? new THREE.Vector3(...me.position) : null;
  }, [clients, myId]);

  useEffect(() => {
    if (selectedClientId && !clients.some((c) => c.id === selectedClientId)) {
      setSelectedClientId(null);
    }
  }, [clients, selectedClientId]);

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clients.find((c) => c.id === selectedClientId) ?? null;
  }, [clients, selectedClientId]);

  const renderControlButton = (
    key: string,
    label: string,
    onClick: () => void,
    icon: ReactNode
  ) => (
    <div key={key} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHoveredControl(key)}
        onMouseLeave={() => setHoveredControl((prev) => (prev === key ? null : prev))}
        style={{
          padding: 8,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(0,0,0,0.5)",
          color: "#fff",
          backdropFilter: "blur(6px)",
          cursor: "pointer",
        }}
        aria-label={label}
      >
        {icon}
      </button>
      {hoveredControl === key && (
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "calc(100% + 12px)",
            transform: "translateY(-50%)",
            padding: "0.3rem 0.6rem",
            borderRadius: 8,
            background: "rgba(0,0,0,0.85)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.85)",
            fontSize: "0.7rem",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
            zIndex: 20,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <h2
          style={{
          position: "absolute",
          top: 18,
          left: 98,
          zIndex: 20,
          color: "#fff",
          fontSize: "0.85rem",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textShadow: "0 2px 8px #000, 0 0px 2px #0ff",
          margin: 0,
          padding: "2px 10px",
          borderRadius: 8,
        }}
      >
       //Legion Swarm Network//
      </h2>

      {/* Controls */}
      <div
        id="camera-controls"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {renderControlButton("reset", "Reset camera", () => setResetSignal((s) => s + 1), <RefreshCw size={20} />)}
        {renderControlButton("zoom-in", "Zoom in", () => setZoomSignal({ action: "in", trigger: Date.now() }), <ZoomIn size={20} />)}
        {renderControlButton("zoom-out", "Zoom out", () => setZoomSignal({ action: "out", trigger: Date.now() }), <ZoomOut size={20} />)}
      </div>
      <Canvas
        style={{ width: "100%", height: "100%", background: "#222" }}
        onPointerMissed={() => setSelectedClientId(null)}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={1.0} />

        <FocusController
          myPosition={myPosition}
          resetSignal={resetSignal}
          zoomSignal={zoomSignal}
        />

        {clients.map((client) => (
          <MetaBall
            key={client.id}
            client={client}
            uniforms={globalUniforms.current}
            onSelect={setSelectedClientId}
            label={client.id === myId ? "you" : undefined}
          />
        ))}

        <QuantumLinks clients={clients} />
        <GlobalUniformsUpdater uniformsRef={globalUniforms} />
      </Canvas>

      <GroupChat />

      <button
        type="button"
        onClick={() => router.push("/commune")}
        style={{
          position: "absolute",
          right: 24,
          bottom: 24,
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(30,30,30,0.85)",
          color: "#f0f0f0",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 10px 24px rgba(0,0,0,0.45)",
        }}
        title="Open commune"
      >
        <MessagesSquare size={22} />
        {notificationCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "#ff6b6b",
              color: "#0c0c11",
              fontSize: "0.7rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {notificationCount}
          </span>
        )}
      </button>

      {selectedClient && (
        <ClientDetailsOverlay
          client={selectedClient}
          votes={votes}
          query={query}
          onClose={() => setSelectedClientId(null)}
        />
      )}

    </div>
  );
}






