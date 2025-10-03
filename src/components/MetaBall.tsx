"use client";

import * as THREE from "three";
import { Text, useCursor } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";

type MetaBallClient = {
  id: string;
  position?: [number, number, number];
  color: [number, number, number];
  status?: "idle" | "processing" | "voted";
};

type MetaBallProps = {
  client: MetaBallClient;
  uniforms: { [key: string]: THREE.IUniform };
  onSelect?: (clientId: string) => void;
  label?: string;
};

const vertexShader = `
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uPhase;
  uniform float uSpeed;
  uniform vec3 uMouse;
  uniform float uStrength;

  float directionalWave(vec3 pos, vec3 dir, float speed, float scale) {
    return sin(dot(pos, dir) * scale + uTime * speed);
  }

  void main() {
    vNormal = normal;

    float w1 = directionalWave(position, normalize(vec3(1.0, 0.3, 0.5)), 1.5 * uSpeed, 2.5);
    float w2 = directionalWave(position, normalize(vec3(-0.4, 1.0, 0.2)), 2.0 * uSpeed, 3.0);
    float w3 = directionalWave(position, normalize(vec3(0.2, -0.6, 1.0)), 1.2 * uSpeed, 4.0);

    float displacement = (w1 + w2 + w3) * 0.25 + sin(uTime + uPhase) * 0.15;

    float dist = length((modelMatrix * vec4(position, 1.0)).xyz - uMouse);
    displacement += exp(-dist * 1.5) * uStrength;

    vec3 displaced = position + normal * displacement * 0.6;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = `
  varying vec3 vNormal;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uPhase;

  void main() {
    float glow = 0.5 + 0.5 * sin(uTime * 2.5 + vNormal.x * 5.0 + vNormal.y * 7.0 + uPhase);
    vec3 color = uColor * (0.6 + glow * 0.4);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const METRIC_OPTIONS = [
  { label: "Influence", min: 30, max: 100, decimals: 1, suffix: "%" },
  { label: "Confidence", min: 55, max: 100, decimals: 1, suffix: "%" },
  { label: "Coherence", min: 0.35, max: 0.98, decimals: 2, suffix: "" },
  { label: "Signal Strength", min: 40, max: 100, decimals: 0, suffix: "%" },
  { label: "Latency", min: 120, max: 420, decimals: 0, suffix: "ms" },
  { label: "Alignment", min: 45, max: 100, decimals: 1, suffix: "%" },
  { label: "Entropy Rate", min: 0.15, max: 2.4, decimals: 2, suffix: "" },
  { label: "Resonance", min: 0.4, max: 0.95, decimals: 2, suffix: "" },
  { label: "Bandwidth", min: 1.1, max: 5.8, decimals: 2, suffix: "kbps" },
  { label: "Neuroflux", min: 18, max: 92, decimals: 1, suffix: "%" },
];

function formatMetricValue(option: typeof METRIC_OPTIONS[number]) {
  const value = option.min + Math.random() * (option.max - option.min);
  return `${value.toFixed(option.decimals)}${option.suffix}`;
}

export default function MetaBall({ client, uniforms, onSelect, label }: MetaBallProps) {
  const { camera, mouse } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const [hovered, setHovered] = useState(false);

  const { id, position, color, status } = client;

  useCursor(hovered);

  const stablePosition = useMemo<[number, number, number]>(() => {
    if (position) return position;
    return [
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
    ];
  }, [position]);

  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const speed = useMemo(() => 0.8 + Math.random() * 0.6, []);
  const clientColor = useMemo(
    () => new THREE.Color(color[0], color[1], color[2]),
    [color]
  );

  const metrics = useMemo(() => {
    const shuffled = [...METRIC_OPTIONS];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 3).map((option) => ({
      label: option.label,
      value: formatMetricValue(option),
    }));
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.ShaderMaterial;

    raycaster.setFromCamera(mouse, camera);
    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const mousePoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeZ, mousePoint);

    material.uniforms.uMouse.value.copy(mousePoint);
    material.uniforms.uStrength.value = 0.5;
  });

  return (
    <group position={stablePosition}>
      <mesh
        ref={meshRef}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (onSelect) {
            onSelect(id);
          }
        }}
      >
        <sphereGeometry args={[0.8, 48, 32]} />
        <shaderMaterial
          key={clientColor.getHex()}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uTime: uniforms.uTime,
            uColor: { value: clientColor },
            uPhase: { value: phase },
            uSpeed: { value: speed },
            uMouse: { value: new THREE.Vector3(999, 999, 999) },
            uStrength: { value: 0.0 },
          }}
          wireframe
        />
      </mesh>

      {label && (
        <Text
          position={[0, 1.25, 0]}
          fontSize={0.12}
          color="white"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.004}
          outlineColor="#000"
        >
          {label}
        </Text>
      )}

      {status === "processing" &&
        metrics.map((metric, index) => (
          <Text
            key={`${metric.label}-${index}`}
            position={[0, 1.05 - index * 0.18, 0]}
            fontSize={0.075}
            color="white"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.0035}
            outlineColor="#000"
          >
            {metric.label}: {metric.value}
          </Text>
        ))}
    </group>
  );
}
